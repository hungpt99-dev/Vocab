import { sendMessage } from '@/shared/messaging/client';

export const READING_MODE_LAYOUTS = [
  'side-by-side',
  'original-first',
  'translation-first',
  'hover-translation',
  'toggle-translation',
] as const;

export type ReadingModeLayout = (typeof READING_MODE_LAYOUTS)[number];

export interface ReadingModeLayoutMeta {
  id: ReadingModeLayout;
  label: string;
}

export const READING_MODE_LAYOUT_META: ReadingModeLayoutMeta[] = [
  { id: 'side-by-side', label: 'Side by side' },
  { id: 'original-first', label: 'Original first' },
  { id: 'translation-first', label: 'Translation first' },
  { id: 'hover-translation', label: 'Hover translation' },
  { id: 'toggle-translation', label: 'Toggle translation' },
] as const;

/** A single extractable unit of an article: a heading or a paragraph. */
export interface ReadingBlock {
  kind: 'heading' | 'paragraph';
  text: string;
}

export interface ReadableContent {
  title: string;
  blocks: ReadingBlock[];
}

/** Blocks beyond this bound are left out so translation stays fast and cheap. */
export const MAX_BLOCKS = 12;

const OVERLAY_ID = 'avs-reading-mode';
const BLOCKS_CLASS = 'avs-reading-blocks';
const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote';
const SKIP_SELECTOR =
  'script, style, noscript, code, pre, nav, aside, form, button, textarea, select, input, .avs-reading-mode';

/**
 * Requests a translation for every block through the message bus. The service
 * worker resolves the configured provider; the content script never touches a
 * provider directly.
 */
export type TranslateBlocks = (blocks: string[]) => Promise<Array<string | null>>;

const defaultTranslate: TranslateBlocks = (blocks) =>
  sendMessage({ type: 'translate-blocks', payload: { blocks } });

/**
 * Reading mode: a distraction-free, bilingual view of the page's article.
 * Pure DOM (no framework) so it can live inside the content-script IIFE bundle.
 * The layout and translation visibility are CSS state on the blocks container,
 * so switching layouts is instant and never rebuilds the article.
 */
export class ReadingMode {
  private element: HTMLElement | null = null;
  private blocksContainer: HTMLElement | null = null;
  private layoutSelect: HTMLSelectElement | null = null;
  private toggleButton: HTMLButtonElement | null = null;
  private statusBanner: HTMLElement | null = null;
  private blockElements = new Map<number, { original: HTMLElement; translation: HTMLElement }>();
  private layout: ReadingModeLayout = 'side-by-side';
  private showTranslations = false;

  constructor(private readonly translate: TranslateBlocks = defaultTranslate) {}

  get isOpen(): boolean {
    return !!this.element?.isConnected;
  }

  open(content: ReadableContent): void {
    if (this.isOpen || content.blocks.length === 0) return;
    this.layout = 'side-by-side';
    this.showTranslations = false;
    this.blockElements.clear();
    this.buildOverlay(content);
    void this.requestTranslations(content);
  }

  setLayout(layout: ReadingModeLayout): void {
    this.layout = layout;
    this.syncLayoutState();
  }

  /** Toggle all translations (only meaningful in the toggle-translation layout). */
  toggleTranslations(): void {
    if (this.layout !== 'toggle-translation') return;
    this.showTranslations = !this.showTranslations;
    this.syncLayoutState();
  }

  close(): void {
    this.element?.remove();
    this.element = null;
    this.blocksContainer = null;
    this.layoutSelect = null;
    this.toggleButton = null;
    this.statusBanner = null;
    this.blockElements.clear();
  }

  private buildOverlay(content: ReadableContent): void {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'avs-reading-mode';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Reading mode');

    const header = document.createElement('header');
    header.className = 'avs-reading-header';

    const title = document.createElement('h2');
    title.className = 'avs-reading-title';
    title.textContent = content.title || 'Reading mode';

    const controls = document.createElement('div');
    controls.className = 'avs-reading-controls';

    const layoutLabel = document.createElement('label');
    layoutLabel.className = 'avs-reading-label';
    layoutLabel.textContent = 'Layout';
    layoutLabel.htmlFor = 'avs-reading-layout';

    const layoutSelect = document.createElement('select');
    layoutSelect.id = 'avs-reading-layout';
    layoutSelect.className = 'avs-reading-layout';
    for (const meta of READING_MODE_LAYOUT_META) {
      const option = document.createElement('option');
      option.value = meta.id;
      option.textContent = meta.label;
      layoutSelect.append(option);
    }
    layoutSelect.addEventListener('change', () => {
      const value = READING_MODE_LAYOUTS.find((id) => id === layoutSelect.value);
      if (value) this.setLayout(value);
    });

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'avs-reading-toggle';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.hidden = true;
    toggle.addEventListener('click', () => this.toggleTranslations());

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'avs-reading-close';
    close.setAttribute('aria-label', 'Close reading mode');
    close.title = 'Close reading mode';
    // Static SVG (lucide X), trusted markup — never page or model content.
    close.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    close.addEventListener('click', () => this.close());

    controls.append(layoutLabel, layoutSelect, toggle, close);
    header.append(title, controls);

    const statusBanner = document.createElement('div');
    statusBanner.className = 'avs-reading-status';
    statusBanner.setAttribute('role', 'status');
    statusBanner.hidden = true;

    const scroll = document.createElement('div');
    scroll.className = 'avs-reading-scroll';

    const blocksContainer = document.createElement('div');
    blocksContainer.className = BLOCKS_CLASS;
    for (const [index, block] of content.blocks.entries()) {
      blocksContainer.append(this.buildBlockElement(index, block));
    }
    scroll.append(blocksContainer);

    overlay.append(header, statusBanner, scroll);
    document.body.append(overlay);

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });

    this.element = overlay;
    this.blocksContainer = blocksContainer;
    this.layoutSelect = layoutSelect;
    this.toggleButton = toggle;
    this.statusBanner = statusBanner;
    this.syncLayoutState();
  }

  private buildBlockElement(index: number, block: ReadingBlock): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'avs-reading-block';
    wrapper.dataset.kind = block.kind;

    const original = document.createElement('div');
    original.className = 'avs-reading-original';
    original.textContent = block.text;
    // Focusable so hover-translation is reachable by keyboard as well as mouse.
    original.tabIndex = -1;

    const translation = document.createElement('div');
    translation.className = 'avs-reading-translation';
    translation.dataset.status = 'pending';
    translation.setAttribute('aria-live', 'polite');
    translation.textContent = 'Loading translation…';

    wrapper.append(original, translation);
    this.blockElements.set(index, { original, translation });
    return wrapper;
  }

  /** Apply the current layout + translation visibility with CSS state only. */
  private syncLayoutState(): void {
    if (!this.blocksContainer) return;
    this.blocksContainer.dataset.layout = this.layout;
    this.blocksContainer.dataset.showTranslation = String(this.showTranslations);
    if (this.layoutSelect) this.layoutSelect.value = this.layout;
    if (this.toggleButton) {
      this.toggleButton.hidden = this.layout !== 'toggle-translation';
      this.toggleButton.textContent = this.showTranslations ? 'Hide translations' : 'Show translations';
      this.toggleButton.setAttribute('aria-pressed', String(this.showTranslations));
    }
    // Hover-translation keeps the original keyboard-reachable; other layouts do
    // not add extra tab stops.
    for (const { original } of this.blockElements.values()) {
      original.tabIndex = this.layout === 'hover-translation' ? 0 : -1;
    }
  }

  private async requestTranslations(content: ReadableContent): Promise<void> {
    const texts = content.blocks.map((block) => block.text);
    let results: Array<string | null>;
    try {
      results = await this.translate(texts);
    } catch {
      // No active provider, an unreachable worker, or a malformed response: the
      // whole article cannot be translated, so surface that instead of a dead UI.
      this.showStatus('Translation unavailable. Configure an AI provider in Settings and try again.');
      results = texts.map(() => null);
    }
    results.forEach((translation, index) => {
      if (translation && translation.trim()) {
        this.setTranslation(index, translation);
      } else {
        this.setTranslationError(index);
      }
    });
  }

  private setTranslation(index: number, text: string): void {
    const cells = this.blockElements.get(index);
    if (!cells) return;
    cells.translation.textContent = text;
    cells.translation.dataset.status = 'done';
  }

  private setTranslationError(index: number): void {
    const cells = this.blockElements.get(index);
    if (!cells) return;
    cells.translation.textContent = 'Translation unavailable';
    cells.translation.dataset.status = 'error';
  }

  private showStatus(message: string): void {
    if (!this.statusBanner) return;
    this.statusBanner.textContent = message;
    this.statusBanner.hidden = false;
  }
}

/**
 * Extract the article's readable content: the title plus a bounded list of
 * top-level headings and paragraphs. Skips navigation, code and interactive
 * regions so reading mode shows the actual article.
 */
export function extractReadableContent(doc: Document = document, maxBlocks = MAX_BLOCKS): ReadableContent {
  const root = findArticleRoot(doc);
  const titleElement = root.querySelector('h1');
  const title = (titleElement?.textContent ?? doc.title).trim();
  const blocks: ReadingBlock[] = [];
  const seen = new Set<string>();

  for (const element of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    if (blocks.length >= maxBlocks) break;
    // The article's own h1 is the overlay title; do not repeat it as a block.
    if (element === titleElement) continue;
    if (element.closest(SKIP_SELECTOR)) continue;
    if (hasBlockAncestor(element, root)) continue;
    const text = (element.textContent ?? '').replace(/\s+/gu, ' ').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    blocks.push({ kind: isHeading(element.tagName) ? 'heading' : 'paragraph', text });
  }

  return { title, blocks };
}

/** The <article> when present, otherwise the largest text-bearing container. */
function findArticleRoot(doc: Document): HTMLElement {
  const article = doc.querySelector('article');
  if (article instanceof HTMLElement) return article;

  let best = doc.body;
  let bestScore = -1;
  for (const candidate of doc.body.querySelectorAll<HTMLElement>('main, div, section')) {
    if (candidate.closest(`.${OVERLAY_ID}`)) continue;
    const score = (candidate.textContent ?? '').length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** True when a block is nested inside another collected block (e.g. <p> in <blockquote>). */
function hasBlockAncestor(element: HTMLElement, root: HTMLElement): boolean {
  let parent = element.parentElement;
  while (parent && parent !== root) {
    if (parent.matches(BLOCK_SELECTOR)) return true;
    parent = parent.parentElement;
  }
  return false;
}

function isHeading(tagName: string): boolean {
  return /^H[1-6]$/.test(tagName);
}
