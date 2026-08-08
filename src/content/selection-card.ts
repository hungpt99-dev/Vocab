import { detectLanguage } from '@/shared/lib/text';
import type { ExplainKind } from '@/shared/types/ai';
import type { Explanation } from '@/shared/types/vocabulary';
import { aiErrorMessage } from '@/ai/types';
import type { SelectionPayload } from '@/shared/messaging/contract';
import { computePosition } from './hover-card';
import { sendMessage } from '@/shared/messaging/client';
import { toExplainUnit } from './explain-popover';
import {
  ICON_BOOKMARK,
  ICON_COPY,
  ICON_MINIMIZE,
  ICON_MORE,
  ICON_SPARKLES,
} from './icons';

const CARD_ID = 'avs-selection-card';

export type SelectionUnit = 'word' | 'phrase' | 'sentence' | 'paragraph';

export interface CardState {
  text: string;
  sentence?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  unit: SelectionUnit;
  rect: { top: number; bottom: number; left: number; width: number };
  selection?: SelectionPayload;
}

const CARD_ACTIONS = [
  { id: 'explain', label: 'Explain with AI', icon: ICON_SPARKLES },
  { id: 'simplify', label: 'Simplify', icon: ICON_MINIMIZE },
  { id: 'save', label: 'Save to Vocabulary', icon: ICON_BOOKMARK },
  { id: 'copy', label: 'Copy', icon: ICON_COPY },
  { id: 'more', label: 'More', icon: ICON_MORE },
] as const;

export type CardActionId = (typeof CARD_ACTIONS)[number]['id'];

/**
 * Replacement for the thin selection toolbar: a proper card/panel that shows
 * the highlighted word, its keyless translation, and (on demand) the AI-enriched
 * explanation — all in a clean, readable layout. Pure DOM so it lives inside the
 * content-script IIFE bundle. Emits the same CustomEvents the entry point already
 * routes (avs-toolbar-action / avs-assist-action).
 */
export class SelectionCard {
  private element: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private buttons: HTMLButtonElement[] = [];
  private state: CardState | null = null;
  private scrollHandler = (): void => this.reposition();

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const card = document.createElement('div');
    card.id = CARD_ID;
    card.className = 'avs-card avs-selection-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Selected text');
    card.hidden = true;

    // Header: word + translation.
    const header = document.createElement('div');
    header.className = 'avs-selection-card-header';
    const word = document.createElement('div');
    word.className = 'avs-selection-card-word';
    word.dataset.role = 'word';
    const translation = document.createElement('div');
    translation.className = 'avs-selection-card-translation';
    translation.dataset.role = 'translation';
    translation.textContent = 'Translating…';
    header.append(word, translation);
    card.append(header);

    // Actions row.
    const actions = document.createElement('div');
    actions.className = 'avs-selection-card-actions';
    for (const action of CARD_ACTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'avs-selection-card-btn';
      button.dataset.action = action.id;
      button.setAttribute('aria-label', action.label);
      button.title = action.label;
      button.tabIndex = this.buttons.length === 0 ? 0 : -1;
      button.innerHTML = action.icon;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.state) {
          document.dispatchEvent(
            new CustomEvent('avs-toolbar-action', {
              detail: { action: action.id, text: this.state.text, state: this.state },
            }),
          );
        }
      });
      this.buttons.push(button);
      actions.append(button);
    }
    card.append(actions);

    // Expandable enrich body.
    const body = document.createElement('div');
    body.className = 'avs-selection-card-body';
    body.hidden = true;
    card.append(body);
    this.body = body;

    document.body.append(card);
    this.element = card;
    return card;
  }

  show(state: CardState): void {
    this.state = state;
    const card = this.ensureElement();
    this.buttons.forEach((button, index) => {
      button.tabIndex = index === 0 ? 0 : -1;
    });
    const wordEl = card.querySelector<HTMLElement>('[data-role="word"]');
    const translationEl = card.querySelector<HTMLElement>('[data-role="translation"]');
    if (wordEl) wordEl.textContent = state.text;
    if (translationEl) {
      translationEl.textContent = 'Translating…';
      void this.loadTranslation(state.text, translationEl);
    }
    // Collapse any expanded body from a previous selection.
    if (this.body) this.body.hidden = true;
    card.classList.remove('avs-selection-card--expanded');
    card.hidden = false;
    this.reposition();
    window.addEventListener('scroll', this.scrollHandler, true);
  }

  /** Fetch the keyless translation inline (no AI key needed). */
  private async loadTranslation(text: string, el: HTMLElement): Promise<void> {
    try {
      const result = await sendMessage({ type: 'translate', payload: { text } });
      el.textContent = result && result !== text ? result : '—';
    } catch {
      el.textContent = '—';
    }
  }

  /** Expand the card and render the AI explanation inline. */
  async showExplain(state: CardState, kind: ExplainKind): Promise<void> {
    const card = this.ensureElement();
    if (!this.body) return;
    this.body.hidden = false;
    card.classList.add('avs-selection-card--expanded');
    this.body.replaceChildren(this.statusRow('Asking the AI…'));
    this.reposition();

    try {
      const explanation = await sendMessage({
        type: 'explain',
        payload: {
          word: state.text,
          unit: toExplainUnit(state.unit),
          context: state.sentence ?? '',
          pageTitle: state.sourceTitle ?? '',
          precedingText: '',
          language: detectLanguage(state.text),
          kind,
        },
      });
      this.body.replaceChildren(...this.renderExplanation(explanation, kind));
    } catch (cause) {
      const message = aiErrorMessage(cause);
      const frag = document.createDocumentFragment();
      frag.append(this.statusRow(message));
      if (/no ai provider|provider is configured|api key/i.test(message)) {
        const settings = document.createElement('button');
        settings.type = 'button';
        settings.className = 'avs-selection-card-settings';
        settings.textContent = 'Open Settings';
        settings.addEventListener('click', () => {
          void sendMessage({ type: 'open-options' });
          this.hide();
        });
        frag.append(settings);
      }
      this.body.replaceChildren(frag);
    }
    this.reposition();
  }

  private statusRow(message: string): HTMLElement {
    const row = document.createElement('p');
    row.className = 'avs-selection-card-status';
    row.textContent = message;
    row.setAttribute('role', 'status');
    return row;
  }

  private renderExplanation(explanation: Explanation, kind: ExplainKind): HTMLElement[] {
    const rows: HTMLElement[] = [];
    const field = (label: string, value: string | undefined): void => {
      if (!value) return;
      const wrap = document.createElement('div');
      wrap.className = 'avs-selection-card-field';
      const l = document.createElement('span');
      l.className = 'avs-selection-card-field-label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'avs-selection-card-field-value';
      v.textContent = value;
      wrap.append(l, v);
      rows.push(wrap);
    };
    const list = (label: string, items: readonly string[] | undefined): void => {
      if (!items || items.length === 0) return;
      const wrap = document.createElement('div');
      wrap.className = 'avs-selection-card-field';
      const l = document.createElement('span');
      l.className = 'avs-selection-card-field-label';
      l.textContent = label;
      const ul = document.createElement('ul');
      ul.className = 'avs-selection-card-list';
      for (const item of items) {
        const li = document.createElement('li');
        li.textContent = item;
        ul.append(li);
      }
      wrap.append(l, ul);
      rows.push(wrap);
    };

    if (kind === 'simplify') {
      field('Simplified', explanation.meaning || explanation.summary);
      field('Translation', explanation.translation);
      return rows;
    }
    if (kind === 'summarize') {
      field('Summary', explanation.summary || explanation.meaning);
      return rows;
    }
    field('Meaning', explanation.meaning);
    field('Translation', explanation.translation);
    field('Pronunciation', explanation.pronunciation);
    field('Part of speech', explanation.partOfSpeech || explanation.grammar);
    list('Examples', explanation.examples);
    list('Synonyms', explanation.synonyms);
    list('Related words', explanation.relatedWords);
    return rows;
  }

  hide(): void {
    if (this.element) this.element.hidden = true;
    this.state = null;
    window.removeEventListener('scroll', this.scrollHandler, true);
  }

  get isVisible(): boolean {
    return !!this.element?.isConnected && !this.element.hidden;
  }

  destroy(): void {
    this.hide();
    this.element?.remove();
    this.element = null;
  }

  private reposition(): void {
    if (!this.state || !this.element) return;
    const { width, height } = this.element.getBoundingClientRect();
    const { top, left } = computePosition(
      this.state.rect,
      { width, height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
  }
}
