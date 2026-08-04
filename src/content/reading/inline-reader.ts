import { sendMessage } from '@/shared/messaging/client';
import { settingsRepository } from '@/storage/settings-repository';
import { splitIntoSentences } from '@/shared/lib/text';
import {
  getReadingPreferences,
  setReadingPreferences,
  watchReadingPreferences,
  type ReadingAlignment,
  type ReadingMode,
} from './preferences';
import { extractArticle, type ArticleBlock } from './extract';
import { buildGlossBlock, buildSentenceBlock } from './gloss';
import type { WordAlignResult } from '@/ai/types';
import { ICON_BOOK_OPEN, ICON_CLOSE, ICON_LANGUAGES, ICON_GLOSS_WORD } from '../icons';

/**
 * Inline bilingual reading: keeps the original page UI intact and injects the
 * translation of each sentence (or paragraph) directly beneath the source text
 * on the live page — like a bilingual book laid over the real article. No
 * separate dialog or overlay replaces the site.
 */
export class InlineReader {
  private readonly injected = new Map<string, HTMLElement[]>();
  private control: HTMLElement | null = null;
  private modeButton: HTMLButtonElement | null = null;
  private prefsListener: (() => void) | null = null;
  private alignment: ReadingAlignment = 'sentence';
  private mode: ReadingMode = 'word';
  private active = false;
  /** Monotonic token; bumped on every (re)inject or close so a stale in-flight
   *  batch can tell it has been superseded and must not append nodes. */
  private generation = 0;

  get isOpen(): boolean {
    return this.active;
  }

  async toggle(): Promise<boolean> {
    if (this.active) {
      this.close();
      return false;
    }
    return this.open();
  }

  async open(): Promise<boolean> {
    if (this.active) return true;
    const blocks = extractArticle();
    if (blocks.length === 0) return false;

    const [prefs, settings] = await Promise.all([getReadingPreferences(), settingsRepository.get()]);
    this.alignment = prefs.alignment;
    this.mode = prefs.mode;
    this.active = true;
    this.generation += 1;

    if (settings.bilingualMode) {
      await this.injectAll(blocks);
    }
    this.buildControl(settings.bilingualMode);
    this.prefsListener = watchReadingPreferences((next) => {
      this.alignment = next.alignment;
      if (next.mode !== this.mode) {
        this.mode = next.mode;
        void this.rerender(blocks);
      }
      this.refreshControl();
    });
    return true;
  }

  close(): void {
    this.active = false;
    this.generation += 1;
    for (const nodes of this.injected.values()) {
      for (const node of nodes) node.remove();
    }
    this.injected.clear();
    this.control?.remove();
    this.control = null;
    this.modeButton = null;
    this.prefsListener?.();
    this.prefsListener = null;
  }

  /** Re-inject translations after a mode change (clears the old ones first). */
  private async rerender(blocks: ArticleBlock[]): Promise<void> {
    this.generation += 1;
    for (const nodes of this.injected.values()) {
      for (const node of nodes) node.remove();
    }
    this.injected.clear();
    await this.injectAll(blocks);
  }

  private async injectAll(blocks: ArticleBlock[]): Promise<void> {
    const generation = this.generation;
    const items: Array<{ id: string; text: string; anchor: HTMLElement }> = [];
    for (const block of blocks) {
      const targets = this.resolveTargets(block);
      for (const target of targets) items.push(target);
    }
    if (items.length === 0) return;

    if (this.mode === 'word') {
      const aligned = await this.alignItems(items);
      // A close() or rerender() may have superseded this batch while we waited
      // on the AI call; if so, discard rather than append stale duplicates.
      if (this.generation !== generation) return;
      for (const item of items) {
        const result = aligned.get(item.id);
        if (!result) continue;
        const node = buildGlossBlock(result);
        item.anchor.after(node);
        const list = this.injected.get(item.id) ?? [];
        list.push(node);
        this.injected.set(item.id, list);
      }
      return;
    }

    // Sentence mode: one full-block (or full-sentence) translation line each.
    const translated = await this.translateItems(items);
    if (this.generation !== generation) return;
    for (const item of items) {
      const translation = translated.get(item.id);
      if (!translation) continue;
      const node = buildSentenceBlock(translation);
      item.anchor.after(node);
      const list = this.injected.get(item.id) ?? [];
      list.push(node);
      this.injected.set(item.id, list);
    }
  }

  private async alignItems(
    items: Array<{ id: string; text: string }>,
  ): Promise<Map<string, WordAlignResult>> {
    const out = new Map<string, WordAlignResult>();
    try {
      const settings = await settingsRepository.get();
      const language = settings.targetLanguage || 'English';
      const results = await sendMessage({
        type: 'align-words',
        payload: { paragraphs: items.map(({ id, text }) => ({ id, text })), language },
      });
      for (const result of results) out.set(result.id, result);
    } catch {
      /* leave empty; no glosses injected */
    }
    return out;
  }

  private async translateItems(
    items: Array<{ id: string; text: string }>,
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    try {
      const settings = await settingsRepository.get();
      const language = settings.targetLanguage || 'English';
      const result = await sendMessage({
        type: 'translate-article',
        payload: { paragraphs: items.map(({ id, text }) => ({ id, text })), language },
      });
      for (const item of result) out.set(item.id, item.translation);
    } catch {
      /* leave empty; no translations injected */
    }
    return out;
  }

  /** Map a block to (sentence or paragraph) source anchors on the live page. */
  private resolveTargets(block: ArticleBlock): Array<{ id: string; text: string; anchor: HTMLElement }> {
    const source = block.element instanceof HTMLElement ? block.element : null;
    if (!source) return [];

    if (this.alignment === 'sentence') {
      const sentences = splitIntoSentences(block.text);
      if (sentences.length <= 1) {
        return [{ id: block.id, text: block.text, anchor: source }];
      }
      const result: Array<{ id: string; text: string; anchor: HTMLElement }> = [];
      let index = 0;
      for (const sentence of sentences) {
        if (!sentence.trim()) continue;
        const anchor = this.findSentenceAnchor(source, sentence) ?? source;
        result.push({ id: `${block.id}#${index}`, text: sentence, anchor });
        index += 1;
      }
      return result;
    }
    return [{ id: block.id, text: block.text, anchor: source }];
  }

  private findSentenceAnchor(parent: HTMLElement, sentence: string): HTMLElement | null {
    const normalized = sentence.trim().slice(0, 24).replace(/"/g, '');
    if (!normalized) return null;
    const match = document.evaluate(
      `.//*[contains(normalize-space(.), "${normalized}")]`,
      parent,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    ).singleNodeValue;
    return match instanceof HTMLElement ? match : null;
  }

  private buildControl(visible: boolean): void {
    const control = document.createElement('div');
    control.className = 'avs-inline-control';
    control.hidden = !visible;

    const label = document.createElement('span');
    label.className = 'avs-inline-control-label';
    label.innerHTML = `${ICON_LANGUAGES}<span>Bilingual</span>`;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'avs-inline-btn';
    toggle.innerHTML = ICON_BOOK_OPEN;
    toggle.title = 'Show/hide translations';
    toggle.setAttribute('aria-label', 'Show or hide translations');
    toggle.setAttribute('aria-pressed', 'true');
    toggle.addEventListener('click', () => {
      const next = !control.dataset.on || control.dataset.on === 'false';
      control.dataset.on = String(next);
      toggle.setAttribute('aria-pressed', String(next));
      for (const nodes of this.injected.values()) {
        for (const node of nodes) node.hidden = !next;
      }
    });
    control.dataset.on = 'true';

    const align = document.createElement('button');
    align.type = 'button';
    align.className = 'avs-inline-btn';
    align.innerHTML = this.mode === 'word' ? ICON_GLOSS_WORD : ICON_LANGUAGES;
    align.title = this.mode === 'word' ? 'Word-by-word gloss (click for sentence)' : 'Sentence translation (click for word-by-word)';
    align.setAttribute('aria-label', 'Switch bilingual mode: word-by-word or sentence');
    align.addEventListener('click', () => {
      const next: ReadingMode = this.mode === 'word' ? 'sentence' : 'word';
      void setReadingPreferences({ mode: next });
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'avs-inline-btn';
    close.innerHTML = ICON_CLOSE;
    close.title = 'Close bilingual reading';
    close.setAttribute('aria-label', 'Close bilingual reading');
    close.addEventListener('click', () => this.close());

    control.append(label, toggle, align, close);
    document.body.append(control);
    this.control = control;
    this.modeButton = align;
  }

  private refreshControl(): void {
    if (!this.modeButton) return;
    this.modeButton.innerHTML = this.mode === 'word' ? ICON_GLOSS_WORD : ICON_LANGUAGES;
    this.modeButton.title =
      this.mode === 'word' ? 'Word-by-word gloss (click for sentence)' : 'Sentence translation (click for word-by-word)';
  }
}
