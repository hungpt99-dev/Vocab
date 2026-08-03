import { sendMessage } from '@/shared/messaging/client';
import { settingsRepository } from '@/storage/settings-repository';
import { splitIntoSentences } from '@/shared/lib/text';
import {
  getReadingPreferences,
  setReadingPreferences,
  watchReadingPreferences,
  type ReadingAlignment,
} from './preferences';
import { extractArticle, type ArticleBlock } from './extract';
import { ICON_BOOK_OPEN, ICON_CLOSE, ICON_ALIGN_SENTENCE } from '../icons';

/**
 * Inline bilingual reading: keeps the original page UI intact and injects the
 * translation of each sentence (or paragraph) directly beneath the source text
 * on the live page — like a bilingual book laid over the real article. No
 * separate dialog or overlay replaces the site.
 */
export class InlineReader {
  private readonly injected = new Map<string, HTMLElement[]>();
  private control: HTMLElement | null = null;
  private prefsListener: (() => void) | null = null;
  private alignment: ReadingAlignment = 'sentence';
  private active = false;

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
    this.active = true;

    if (settings.bilingualMode) {
      await this.injectAll(blocks);
    }
    this.buildControl(settings.bilingualMode);
    this.prefsListener = watchReadingPreferences((next) => {
      this.alignment = next.alignment;
      this.refreshControl();
    });
    return true;
  }

  close(): void {
    for (const nodes of this.injected.values()) {
      for (const node of nodes) node.remove();
    }
    this.injected.clear();
    this.control?.remove();
    this.control = null;
    this.prefsListener?.();
    this.prefsListener = null;
    this.active = false;
  }

  private async injectAll(blocks: ArticleBlock[]): Promise<void> {
    const items: Array<{ id: string; text: string; anchor: HTMLElement }> = [];
    for (const block of blocks) {
      const targets = this.resolveTargets(block);
      for (const target of targets) items.push(target);
    }
    if (items.length === 0) return;

    const translated = await this.translateItems(items.map((item) => ({ id: item.id, text: item.text })));
    for (const item of items) {
      const translation = translated.get(item.id);
      if (!translation) continue;
      const node = this.makeTranslationNode(translation);
      item.anchor.after(node);
      const list = this.injected.get(item.id) ?? [];
      list.push(node);
      this.injected.set(item.id, list);
    }
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

  private async translateItems(
    items: Array<{ id: string; text: string }>,
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    try {
      const settings = await settingsRepository.get();
      const language = settings.targetLanguage || 'English';
      const result = await sendMessage({
        type: 'translate-article',
        payload: { paragraphs: items, language },
      });
      for (const item of result) out.set(item.id, item.translation);
    } catch {
      /* leave translations empty; nodes simply not injected */
    }
    return out;
  }

  private makeTranslationNode(translation: string): HTMLElement {
    const span = document.createElement('span');
    span.className = 'avs-inline-translation';
    span.setAttribute('lang', '');
    span.textContent = translation;
    return span;
  }

  private buildControl(visible: boolean): void {
    const control = document.createElement('div');
    control.className = 'avs-inline-control';
    control.hidden = !visible;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'avs-inline-btn';
    toggle.innerHTML = ICON_BOOK_OPEN;
    toggle.title = 'Toggle inline translations';
    toggle.setAttribute('aria-label', 'Toggle inline translations');
    toggle.addEventListener('click', () => {
      const next = !control.dataset.on || control.dataset.on === 'false';
      control.dataset.on = String(next);
      for (const nodes of this.injected.values()) {
        for (const node of nodes) node.hidden = !next;
      }
    });
    control.dataset.on = 'true';

    const align = document.createElement('button');
    align.type = 'button';
    align.className = 'avs-inline-btn';
    align.innerHTML = ICON_ALIGN_SENTENCE;
    align.title = 'Toggle sentence/paragraph alignment';
    align.setAttribute('aria-label', 'Toggle alignment');
    align.addEventListener('click', () => {
      const next: ReadingAlignment = this.alignment === 'sentence' ? 'paragraph' : 'sentence';
      void setReadingPreferences({ alignment: next });
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'avs-inline-btn';
    close.innerHTML = ICON_CLOSE;
    close.title = 'Close bilingual reading';
    close.setAttribute('aria-label', 'Close bilingual reading');
    close.addEventListener('click', () => this.close());

    control.append(toggle, align, close);
    document.body.append(control);
    this.control = control;
  }

  private refreshControl(): void {
    /* alignment change is picked up on next open; control stays valid */
  }
}
