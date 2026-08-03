import { sendMessage } from '@/shared/messaging/client';
import { settingsRepository } from '@/storage/settings-repository';
import { highlightRoot, removeHighlights } from '../highlighter';
import type { VocabularyMatcher } from '../matcher';
import { extractArticle, type ArticleBlock } from './extract';
import {
  DEFAULT_READING_PREFS,
  getReadingPreferences,
  setReadingPreferences,
  watchReadingPreferences,
  type ReadingLayout,
  type ReadingPreferences,
} from './preferences';
import { applyReaderFontSize, injectReadingStyles } from './styles';

export const CHUNK_SIZE = 8;

const LAYOUT_OPTIONS: ReadonlyArray<readonly [ReadingLayout, string]> = [
  ['side-by-side', 'Side by side'],
  ['original-first', 'Original first'],
  ['translation-first', 'Translation first'],
  ['hover', 'Hover'],
  ['toggle', 'Toggle'],
];

const HEADING_RE = /^H[1-6]$/;

function blockElementTag(tagName: string): string {
  return HEADING_RE.test(tagName) ? tagName : 'P';
}

/** BCP-47 hint for the translated column when the label is a known language. */
const LANGUAGE_TAGS: Record<string, string> = {
  English: 'en',
  Chinese: 'zh',
  'Simplified Chinese': 'zh-Hans',
  'Traditional Chinese': 'zh-Hant',
  Japanese: 'ja',
  Hangul: 'ko',
  Arabic: 'ar',
  Thai: 'th',
  Greek: 'el',
  Devanagari: 'hi',
  Cyrillic: 'ru',
};

function languageTagFor(language: string): string {
  return LANGUAGE_TAGS[language] ?? '';
}

function el(tag: string, className: string, text = ''): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function toolbarButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'avs-reader-btn';
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  button.title = ariaLabel;
  button.addEventListener('click', onClick);
  return button;
}

type RowState = 'pending' | 'loading' | 'done' | 'error';

interface BlockRow {
  block: ArticleBlock;
  section: HTMLElement;
  src: HTMLElement;
  tgt: HTMLElement;
  state: RowState;
}

/**
 * The bilingual reading overlay: renders an article as paragraph-aligned
 * original + translation columns, with layout modes (side-by-side /
 * original-first / translation-first / hover / toggle), reading controls and
 * vocabulary highlighting. Translations are fetched lazily via the message bus
 * (the service worker owns provider access), chunk by chunk, and cached in
 * memory for the session.
 */
export class BilingualReader {
  private root: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private content: HTMLElement | null = null;
  private rows: BlockRow[] = [];
  private readonly translations = new Map<string, string>();
  private readonly chunkState = new Map<number, 'idle' | 'loading' | 'done' | 'error'>();
  private readonly chunkErrorEls = new Map<number, HTMLElement>();
  private sentinels: HTMLElement[] = [];
  private observer: IntersectionObserver | null = null;
  private prefs: ReadingPreferences = DEFAULT_READING_PREFS;
  private language = 'English';
  private matcher: VocabularyMatcher | null = null;
  private previouslyFocused: Element | null = null;
  private prefsListener: (() => void) | null = null;
  private toggleViewButton: HTMLButtonElement | null = null;
  private vocabButton: HTMLButtonElement | null = null;

  get isOpen(): boolean {
    return !!this.root?.isConnected;
  }

  async open(): Promise<boolean> {
    if (this.isOpen) return true;

    const blocks = extractArticle();
    if (blocks.length === 0) return false;

    injectReadingStyles();
    const [prefs, settings] = await Promise.all([getReadingPreferences(), settingsRepository.get()]);
    this.prefs = prefs;
    this.language = settings.targetLanguage || 'English';

    const active = document.activeElement;
    if (active instanceof HTMLElement) this.previouslyFocused = active;

    this.buildDom(blocks);
    this.prefsListener = watchReadingPreferences((next) => this.applyPrefs(next));
    document.addEventListener('keydown', this.onKeydown);

    this.render();
    this.requestChunk(0);
    if (typeof IntersectionObserver !== 'function') {
      void this.translateAll();
    } else {
      this.observeSentinels();
    }
    return true;
  }

  close(): void {
    if (!this.root) return;
    this.observer?.disconnect();
    this.observer = null;
    this.prefsListener?.();
    this.prefsListener = null;
    document.removeEventListener('keydown', this.onKeydown);
    this.root.remove();
    this.root = null;
    this.body = null;
    this.content = null;
    this.rows = [];
    this.translations.clear();
    this.chunkState.clear();
    this.chunkErrorEls.clear();
    this.sentinels = [];
    this.matcher = null;
    if (this.previouslyFocused instanceof HTMLElement) this.previouslyFocused.focus();
    this.previouslyFocused = null;
  }

  async toggle(): Promise<boolean> {
    if (this.isOpen) {
      this.close();
      return true;
    }
    return this.open();
  }

  /** Point the reader at the latest vocabulary matcher for highlighting. */
  updateVocabulary(matcher: VocabularyMatcher | null): void {
    this.matcher = matcher;
    if (this.content) {
      removeHighlights(this.content);
      this.applyHighlights();
    }
  }

  /** Translate every remaining chunk immediately (bypasses lazy loading). */
  async translateAll(): Promise<void> {
    this.observer?.disconnect();
    this.observer = null;
    for (let chunk = 0; chunk < this.chunkCount; chunk += 1) {
      await this.requestChunk(chunk);
    }
  }

  /** Request translation of a single chunk of blocks. Public for tests. */
  async requestChunk(chunkIndex: number): Promise<void> {
    const rows = this.chunkRows(chunkIndex);
    if (rows.length === 0) return;
    const state = this.chunkState.get(chunkIndex) ?? 'idle';
    if (state === 'loading' || state === 'done') return;

    const pending = rows.filter((row) => row.state === 'pending' || row.state === 'error');
    if (pending.length === 0) {
      this.chunkState.set(chunkIndex, 'done');
      return;
    }

    this.chunkState.set(chunkIndex, 'loading');
    for (const row of pending) this.setRowState(row, 'loading');
    this.removeChunkError(chunkIndex);

    try {
      const translated = await sendMessage({
        type: 'translate-article',
        payload: {
          paragraphs: pending.map((row) => ({ id: row.block.id, text: row.block.text })),
          language: this.language,
        },
      });
      for (const item of translated) {
        const row = this.rows.find((candidate) => candidate.block.id === item.id);
        if (!row) continue;
        this.translations.set(item.id, item.translation);
        row.tgt.textContent = item.translation;
        row.tgt.classList.remove('avs-block-placeholder');
        row.state = 'done';
      }
      this.chunkState.set(chunkIndex, 'done');
      this.applyHighlights();
    } catch {
      this.chunkState.set(chunkIndex, 'error');
      for (const row of pending) this.setRowState(row, 'error');
      this.renderChunkError(chunkIndex);
    }
  }

  private get chunkCount(): number {
    return Math.ceil(this.rows.length / CHUNK_SIZE);
  }

  private chunkRows(chunkIndex: number): BlockRow[] {
    const start = chunkIndex * CHUNK_SIZE;
    return this.rows.slice(start, start + CHUNK_SIZE);
  }

  private buildDom(blocks: ArticleBlock[]): void {
    this.rows = blocks.map((block) => this.createRow(block));

    const overlay = el('div', 'avs-reader');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Bilingual reading mode');
    overlay.dataset.view = 'original';

    overlay.append(this.buildToolbar());

    const body = el('div', 'avs-reader-body');
    const content = el('main', 'avs-reader-content');
    for (let chunk = 0; chunk < this.chunkCount; chunk += 1) {
      if (chunk > 0) content.append(this.sentinelFor(chunk));
      for (const row of this.chunkRows(chunk)) content.append(row.section);
    }
    body.append(content);
    overlay.append(body);

    document.body.append(overlay);
    this.root = overlay;
    this.body = body;
    this.content = content;

    this.applyLayoutClass();
    applyReaderFontSize(this.prefs.fontSize);
    this.updateToggleButton();
  }

  private buildToolbar(): HTMLElement {
    const bar = el('header', 'avs-reader-bar');

    const close = toolbarButton('×', 'Close bilingual reading mode', () => this.close());
    close.className += ' avs-reader-close';

    const title = el('span', 'avs-reader-title', 'Bilingual reading');
    const lang = el('span', 'avs-reader-lang', this.language);

    const layoutSelect = document.createElement('select');
    layoutSelect.className = 'avs-reader-select';
    layoutSelect.setAttribute('aria-label', 'Reading layout');
    for (const [value, label] of LAYOUT_OPTIONS) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      layoutSelect.append(option);
    }
    layoutSelect.value = this.prefs.layout;
    layoutSelect.addEventListener('change', () => {
      void this.setPrefs({ layout: layoutSelect.value as ReadingLayout });
    });

    const fontDown = toolbarButton('A−', 'Decrease text size', () =>
      void this.setPrefs({ fontSize: this.prefs.fontSize - 1 }),
    );
    const fontUp = toolbarButton('A+', 'Increase text size', () =>
      void this.setPrefs({ fontSize: this.prefs.fontSize + 1 }),
    );

    this.vocabButton = toolbarButton('Highlight', 'Toggle vocabulary highlighting', () =>
      void this.setPrefs({ highlightVocabulary: !this.prefs.highlightVocabulary }),
    );
    this.vocabButton.setAttribute('aria-pressed', String(this.prefs.highlightVocabulary));

    const translateAll = toolbarButton('Translate all', 'Translate the whole article now', () =>
      void this.translateAll(),
    );

    this.toggleViewButton = toolbarButton('', 'Show the translation', () => this.toggleView());

    bar.append(
      title,
      lang,
      layoutSelect,
      fontDown,
      fontUp,
      this.vocabButton,
      translateAll,
      this.toggleViewButton,
      close,
    );
    return bar;
  }

  private createRow(block: ArticleBlock): BlockRow {
    const section = el('section', 'avs-block');

    const srcCol = el('div', 'avs-block-col avs-block-src');
    const src = document.createElement(blockElementTag(block.tagName));
    src.textContent = block.text;
    srcCol.append(src);

    const tgtCol = el('div', 'avs-block-col avs-block-tgt');
    const tag = languageTagFor(this.language);
    if (tag) tgtCol.setAttribute('lang', tag);
    const tgt = document.createElement(blockElementTag(block.tagName));
    tgt.className = 'avs-block-placeholder';
    tgt.textContent = 'Translating…';
    tgtCol.append(tgt);

    section.append(srcCol, tgtCol);
    return { block, section, src, tgt, state: 'pending' };
  }

  private sentinelFor(chunk: number): HTMLElement {
    const sentinel = el('div', 'avs-sentinel');
    sentinel.dataset.chunk = String(chunk);
    this.sentinels.push(sentinel);
    return sentinel;
  }

  private observeSentinels(): void {
    if (this.sentinels.length === 0) return;
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const chunk = Number((entry.target as HTMLElement).dataset.chunk);
          this.observer?.unobserve(entry.target);
          void this.requestChunk(chunk);
        }
      },
      { root: this.body, rootMargin: '800px 0px' },
    );
    for (const sentinel of this.sentinels) this.observer.observe(sentinel);
  }

  private render(): void {
    for (const row of this.rows) {
      this.applyHighlightsTo(row.src);
      this.setRowState(row, 'pending');
    }
  }

  private setRowState(row: BlockRow, state: RowState): void {
    row.state = state;
    if (state === 'done') {
      const translation = this.translations.get(row.block.id);
      row.tgt.textContent = translation ?? '';
      row.tgt.classList.remove('avs-block-placeholder');
      return;
    }
    if (state === 'error') {
      row.tgt.textContent = 'Translation unavailable';
    } else {
      row.tgt.textContent = 'Translating…';
    }
    row.tgt.classList.add('avs-block-placeholder');
  }

  private renderChunkError(chunkIndex: number): void {
    const firstRow = this.chunkRows(chunkIndex)[0];
    if (!firstRow) return;
    this.removeChunkError(chunkIndex);

    const bar = el('div', 'avs-chunk-error');
    bar.textContent = 'Translation failed for this section.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => {
      this.removeChunkError(chunkIndex);
      void this.requestChunk(chunkIndex);
    });
    bar.append(retry);
    this.chunkErrorEls.set(chunkIndex, bar);
    firstRow.section.before(bar);
  }

  private removeChunkError(chunkIndex: number): void {
    const bar = this.chunkErrorEls.get(chunkIndex);
    if (bar) {
      bar.remove();
      this.chunkErrorEls.delete(chunkIndex);
    }
  }

  private toggleView(): void {
    if (!this.root) return;
    const next = this.root.dataset.view === 'translation' ? 'original' : 'translation';
    this.root.dataset.view = next;
    this.updateToggleButton();
  }

  private updateToggleButton(): void {
    if (!this.toggleViewButton || !this.root) return;
    const inToggleLayout = this.prefs.layout === 'toggle';
    this.toggleViewButton.hidden = !inToggleLayout;
    if (inToggleLayout) {
      const showingTranslation = this.root.dataset.view === 'translation';
      this.toggleViewButton.textContent = showingTranslation ? 'Show original' : 'Show translation';
      this.toggleViewButton.setAttribute(
        'aria-label',
        showingTranslation ? 'Show the original text' : 'Show the translation',
      );
    }
  }

  private applyLayoutClass(): void {
    if (!this.root) return;
    this.root.className = `avs-reader avs-layout-${this.prefs.layout}`;
  }

  private async setPrefs(patch: Partial<ReadingPreferences>): Promise<void> {
    const next = await setReadingPreferences(patch);
    this.applyPrefs(next);
  }

  private applyPrefs(prefs: ReadingPreferences): void {
    const fontSizeChanged = prefs.fontSize !== this.prefs.fontSize;
    this.prefs = prefs;
    this.applyLayoutClass();
    if (fontSizeChanged) applyReaderFontSize(prefs.fontSize);
    this.vocabButton?.setAttribute('aria-pressed', String(prefs.highlightVocabulary));
    this.updateToggleButton();
    if (this.content) this.applyHighlights();
  }

  private onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
  };

  private applyHighlights(): void {
    if (!this.content) return;
    if (this.prefs.highlightVocabulary && this.matcher && this.matcher.size > 0) {
      highlightRoot(this.content, this.matcher);
    } else {
      removeHighlights(this.content);
    }
  }

  private applyHighlightsTo(root: HTMLElement): void {
    if (this.prefs.highlightVocabulary && this.matcher && this.matcher.size > 0) {
      highlightRoot(root, this.matcher);
    }
  }
}
