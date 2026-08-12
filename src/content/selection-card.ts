import { detectLanguage } from '@/shared/lib/text';
import type { ExplainKind } from '@/shared/types/ai';
import type { Explanation } from '@/shared/types/vocabulary';
import type { XRayReadingResult } from '@/shared/types/xray';
import { aiErrorMessage } from '@/ai/types';
import type { SelectionPayload } from '@/shared/messaging/contract';
import { computePosition } from './hover-card';
import { sendMessage } from '@/shared/messaging/client';
import { toExplainUnit } from './explain-popover';
import {
  ICON_BOOKMARK,
  ICON_COPY,
  ICON_SPARKLES,
  ICON_XRAY,
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
  { id: 'generate', label: 'Generate with AI', icon: ICON_SPARKLES },
  // X-Ray Reading: see through complexity to the simple idea inside the text.
  { id: 'xray', label: 'X-Ray Reading', icon: ICON_XRAY },
  { id: 'save', label: 'Save to Vocabulary', icon: ICON_BOOKMARK },
  { id: 'copy', label: 'Copy', icon: ICON_COPY },
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
  /** Monotonic id for the current selection; stale async results are discarded. */
  private selectionToken = 0;
  /** Analysis currently in flight, so a second click cannot fire a duplicate request. */
  private pendingKind: ExplainKind | null = null;
  /**
   * Separate token for AI analyses. Unlike `selectionToken` it is bumped ONLY
   * when a new selection is shown — clicking a card button collapses the page
   * selection, which hides the card, and that must not throw away the analysis
   * the click just started (VOC-121).
   */
  private analysisToken = 0;
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
    // The page fires mouseup/selectionchange again for the SAME selection (e.g.
    // right after a card button is clicked). Re-showing then must not discard an
    // analysis the user just started, so only a genuinely different selection
    // invalidates in-flight work (VOC-121).
    const sameSelection = this.state?.text === state.text;
    this.state = state;
    // Invalidate any in-flight explain/translate for a previous selection so it
    // can't paint stale content into this card (VOC-120).
    this.selectionToken += 1;
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
    if (!sameSelection) {
      // A new selection ends any in-flight analysis for the previous one.
      this.pendingKind = null;
      this.analysisToken += 1;
      // Collapse AND clear any expanded body from a previous selection.
      if (this.body) {
        this.body.replaceChildren();
        this.body.hidden = true;
      }
      card.classList.remove('avs-selection-card--expanded');
    }
    card.hidden = false;
    this.reposition();
    window.addEventListener('scroll', this.scrollHandler, true);
  }

  /** Fetch the keyless translation inline (no AI key needed). */
  private async loadTranslation(text: string, el: HTMLElement): Promise<void> {
    const token = this.selectionToken;
    try {
      const result = await sendMessage({ type: 'translate', payload: { text } });
      // Another selection opened while we were waiting — ignore this stale result.
      if (token !== this.selectionToken) return;
      el.textContent = result && result !== text ? result : '—';
    } catch {
      if (token !== this.selectionToken) return;
      el.textContent = '—';
    }
  }

  /** Expand the card and render the AI explanation inline. */
  async showExplain(state: CardState, kind: ExplainKind): Promise<void> {
    const card = this.ensureElement();
    if (!this.body) return;
    // Prevent duplicate requests: ignore repeat clicks while one is in flight.
    if (this.pendingKind !== null) return;
    this.pendingKind = kind;
    const token = this.analysisToken;
    // Which action button is the loading one: xray keeps its own button, every
    // other kind is the "Generate with AI" button. We surface a button-level
    // loading state (disabled + aria-busy + spinner ring) so the click has
    // immediate, unmistakable feedback — mirroring the popup explain buttons.
    const loadingAction: CardActionId = kind === 'xray' ? 'xray' : 'generate';
    this.setActionLoading(loadingAction, true);
    // Re-show the card: clicking the button collapses the page selection, which
    // hides it, but the user explicitly asked for this analysis.
    card.hidden = false;
    this.body.hidden = false;
    card.classList.add('avs-selection-card--expanded');
    this.body.replaceChildren(
      this.statusRow(kind === 'xray' ? 'X-raying this text…' : 'Asking the AI…'),
    );
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
          // X-Ray Reading is language-agnostic: the model detects the source
          // language itself and explains in the user's configured language, so
          // the content script must not pin the language to the selection's.
          ...(kind === 'xray' ? {} : { language: detectLanguage(state.text) }),
          kind,
        },
      });
      // A newer selection opened while the request was in flight — drop the stale result.
      if (token !== this.analysisToken) return;
      card.hidden = false;
      this.body.hidden = false;
      this.body.replaceChildren(
        ...(kind === 'xray'
          ? this.renderXRay(explanation, state.text)
          : this.renderExplanation(explanation, kind)),
      );
    } catch (cause) {
      if (token !== this.analysisToken) return;
      card.hidden = false;
      this.body.hidden = false;
      const message = aiErrorMessage(cause);
      const frag = document.createDocumentFragment();
      frag.append(this.statusRow(message));
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'avs-selection-card-settings';
      retry.dataset.action = 'retry';
      retry.textContent = 'Try again';
      retry.addEventListener('click', () => {
        // The failed attempt already cleared pendingKind, so this re-runs cleanly.
        void this.showExplain(state, kind);
      });
      frag.append(retry);
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
    } finally {
      // Release the in-flight guard whether we succeeded, failed, or went stale.
      if (this.pendingKind === kind) this.pendingKind = null;
      this.setActionLoading(loadingAction, false);
    }
    this.reposition();
  }

  /** Toggle the loading visual (disabled + aria-busy + spinner ring) on an action button. */
  private setActionLoading(action: CardActionId, loading: boolean): void {
    const button = this.buttons.find((b) => b.dataset.action === action);
    if (!button) return;
    button.classList.toggle('avs-selection-card-btn--loading', loading);
    button.toggleAttribute('disabled', loading);
    button.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  /**
   * Render an X-Ray Reading result: original text, core meaning, what makes it
   * complex, and the reconstruction. Purely structural — no language-specific
   * branching lives here, because the model already adapted its representation
   * to the text's own language and shape.
   */
  private renderXRay(explanation: Explanation, originalText: string): HTMLElement[] {
    const xray: XRayReadingResult | undefined = explanation.xray;
    const rows: HTMLElement[] = [];

    // No structured payload (older model / odd response): fall back to the
    // plain explanation rather than showing an empty panel.
    if (!xray) {
      return this.renderExplanation(explanation, 'sentence');
    }

    const block = (className: string, children: HTMLElement[]): HTMLElement => {
      const wrap = document.createElement('div');
      wrap.className = `avs-xray-block ${className}`;
      wrap.append(...children);
      return wrap;
    };
    const heading = (text: string): HTMLElement => {
      const h = document.createElement('div');
      h.className = 'avs-xray-heading';
      h.textContent = text;
      return h;
    };
    const para = (className: string, text: string): HTMLElement => {
      const p = document.createElement('p');
      p.className = className;
      p.textContent = text;
      return p;
    };

    const original = xray.originalText || originalText;
    if (original) {
      rows.push(block('avs-xray-original', [para('avs-xray-quote', original)]));
    }

    const coreChildren: HTMLElement[] = [heading('Core Meaning')];
    if (xray.core.representation) {
      coreChildren.push(para('avs-xray-representation', xray.core.representation));
    }
    if (xray.core.simpleMeaning) {
      coreChildren.push(para('avs-xray-simple', xray.core.simpleMeaning));
    }
    if (coreChildren.length > 1) rows.push(block('avs-xray-core', coreChildren));

    if (xray.complexity.length > 0) {
      const children: HTMLElement[] = [heading('What Makes It Complex?')];
      for (const layer of xray.complexity) {
        const item = document.createElement('div');
        item.className = 'avs-xray-layer';
        if (layer.text) item.append(para('avs-xray-quote', layer.text));
        if (layer.explanation) item.append(para('avs-xray-layer-explain', layer.explanation));
        if (layer.relatesTo) {
          item.append(para('avs-xray-relates', `→ ${layer.relatesTo}`));
        }
        children.push(item);
      }
      rows.push(block('avs-xray-complexity', children));
    }

    if (xray.relationships.length > 0) {
      const children: HTMLElement[] = [heading('How It Connects')];
      for (const link of xray.relationships) {
        const middle = link.relation ? `${link.relation} → ` : '';
        children.push(para('avs-xray-relationship', `${link.from} → ${middle}${link.to}`));
      }
      rows.push(block('avs-xray-relationships', children));
    }

    if (xray.fullExplanation) {
      rows.push(
        block('avs-xray-together', [
          heading('Put It Together'),
          para('avs-xray-full', xray.fullExplanation),
        ]),
      );
    }

    // ---- Whole-sentence anatomy (VOC-122) -------------------------------
    // Compact, collapsed-by-default sections so the panel still reads as an
    // x-ray at a glance instead of a wall of AI prose. Nothing here is
    // language-specific: the model already described the text using the
    // categories that fit its own language.
    const details = (label: string, build: () => HTMLElement[]): void => {
      const children = build();
      if (children.length === 0) return;
      const section = document.createElement('details');
      section.className = 'avs-xray-section';
      const summary = document.createElement('summary');
      summary.className = 'avs-xray-summary';
      summary.textContent = label;
      section.append(summary, ...children);
      rows.push(section);
    };
    const textSection = (label: string, value: string | undefined): void => {
      if (!value) return;
      details(label, () => [para('avs-xray-section-text', value)]);
    };

    textSection('Structure', xray.structure);
    textSection('Grammar', xray.grammar);
    textSection('Meaning', xray.meaning);
    textSection('Why it is written this way', xray.why);

    details('Vocabulary', () =>
      (xray.vocabulary ?? []).map((item) => {
        const row = document.createElement('div');
        row.className = 'avs-xray-vocab';
        const term = document.createElement('span');
        term.className = 'avs-xray-vocab-term';
        term.textContent = item.term;
        row.append(term);
        if (item.kind) {
          const kind = document.createElement('span');
          kind.className = 'avs-xray-vocab-kind';
          kind.textContent = item.kind;
          row.append(kind);
        }
        row.append(para('avs-xray-vocab-note', item.note));
        return row;
      }),
    );

    textSection('Simpler version', xray.simplerVersion);

    // Difficulty is a single glanceable chip rather than a section.
    if (xray.difficulty) {
      const wrap = document.createElement('div');
      wrap.className = 'avs-xray-difficulty';
      const chip = document.createElement('span');
      chip.className = 'avs-xray-cefr';
      chip.textContent = xray.difficulty.cefr;
      wrap.append(chip);
      if (xray.difficulty.reason) {
        wrap.append(para('avs-xray-difficulty-reason', xray.difficulty.reason));
      }
      rows.push(wrap);
    }

    if (xray.detectedLanguage) {
      rows.push(para('avs-xray-meta', `Detected language: ${xray.detectedLanguage}`));
    }
    return rows;
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
    // Discard any in-flight explain/translate results for this selection.
    this.selectionToken += 1;
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
