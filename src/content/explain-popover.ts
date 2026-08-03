import type { Explanation } from '@/shared/types/vocabulary';
import { computePosition } from './hover-card';

const POPOVER_ID = 'avs-explain-popover';

/** Which view the popover renders: full explanation or translation only. */
export type ExplainPopoverMode = 'explain' | 'translate';

export interface ExplainPopoverDeps {
  /** Fetch an explanation for the selection text via the message bus. */
  load: (text: string) => Promise<Explanation>;
  /** Persist the selection to the vocabulary; rejects on failure. */
  onSave: (text: string) => Promise<void>;
}

export interface ExplainPopoverState {
  text: string;
  mode: ExplainPopoverMode;
  rect: { top: number; bottom: number; left: number; width: number };
}

const MODE_LABEL: Record<ExplainPopoverMode, string> = {
  explain: 'Explain',
  translate: 'Translate',
};

/* Lucide close icon inlined so the popover needs no runtime icon dependency. */
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

/**
 * AI explanation / translation popover, shown when the user picks Explain or
 * Translate from the selection toolbar. Pure DOM (no framework) so it can live
 * inside the content-script IIFE bundle. Renders loading, error (with retry)
 * and success states, and offers saving the selection to the vocabulary.
 */
export class ExplainPopover {
  private element: HTMLElement | null = null;
  private state: ExplainPopoverState | null = null;
  private requestId = 0;
  private scrollHandler = (): void => this.reposition();

  constructor(private readonly deps: ExplainPopoverDeps) {}

  get isVisible(): boolean {
    return !!this.element?.isConnected && !this.element.hidden;
  }

  show(state: ExplainPopoverState): void {
    this.state = state;
    const popover = this.ensureElement();
    this.requestId += 1;
    popover.hidden = false;
    this.renderLoading(state);
    this.reposition();
    window.addEventListener('scroll', this.scrollHandler, true);
    void this.fetch(state);
  }

  hide(): void {
    this.requestId += 1;
    this.state = null;
    if (this.element) this.element.hidden = true;
    window.removeEventListener('scroll', this.scrollHandler, true);
  }

  destroy(): void {
    this.hide();
    this.element?.remove();
    this.element = null;
  }

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const popover = document.createElement('article');
    popover.id = POPOVER_ID;
    popover.className = 'avs-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'true');
    popover.hidden = true;

    const header = document.createElement('header');
    header.className = 'avs-popover-header';

    const mode = document.createElement('span');
    mode.className = 'avs-popover-mode';
    header.append(mode);

    const word = document.createElement('span');
    word.className = 'avs-popover-word';
    word.title = '';
    header.append(word);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'avs-popover-close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = ICON_CLOSE;
    close.addEventListener('click', () => this.hide());
    header.append(close);

    const body = document.createElement('div');
    body.className = 'avs-popover-body';

    const footer = document.createElement('footer');
    footer.className = 'avs-popover-footer';

    const meta = document.createElement('span');
    meta.className = 'avs-popover-meta';
    footer.append(meta);

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'avs-popover-save';
    save.textContent = 'Save to vocabulary';
    save.addEventListener('click', () => void this.handleSave());
    footer.append(save);

    popover.append(header, body, footer);
    document.body.append(popover);
    this.element = popover;
    return popover;
  }

  private async fetch(state: ExplainPopoverState): Promise<void> {
    const id = this.requestId;
    try {
      const explanation = await this.deps.load(state.text);
      if (id !== this.requestId || !this.state) return;
      this.renderExplanation(state, explanation);
    } catch (error) {
      if (id !== this.requestId || !this.state) return;
      const message = error instanceof Error ? error.message : 'Could not get an answer.';
      this.renderError(state, message);
    }
  }

  private async handleSave(): Promise<void> {
    if (!this.state) return;
    const text = this.state.text;
    const save = this.element?.querySelector<HTMLButtonElement>('.avs-popover-save');
    if (save) save.disabled = true;
    try {
      await this.deps.onSave(text);
      this.hide();
    } catch {
      // The caller surfaces an error toast; keep the popover open to retry.
    } finally {
      if (save) save.disabled = false;
    }
  }

  private renderLoading(state: ExplainPopoverState): void {
    const header = this.header();
    const body = this.body();
    header.querySelector('.avs-popover-mode')!.textContent = MODE_LABEL[state.mode];
    const word = header.querySelector<HTMLElement>('.avs-popover-word')!;
    word.textContent = state.text;
    word.title = state.text;
    body.replaceChildren();
    this.meta().textContent = '';

    const status = document.createElement('p');
    status.className = 'avs-popover-status';
    status.setAttribute('aria-busy', 'true');
    status.textContent = 'Asking your AI…';
    body.append(status);
  }

  private renderError(state: ExplainPopoverState, message: string): void {
    const body = this.body();
    body.replaceChildren();
    this.meta().textContent = '';

    const error = document.createElement('p');
    error.className = 'avs-popover-error';
    error.textContent = message;
    body.append(error);

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'avs-popover-retry';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => {
      this.renderLoading(state);
      void this.fetch(state);
    });
    body.append(retry);
  }

  private renderExplanation(state: ExplainPopoverState, explanation: Explanation): void {
    const body = this.body();
    body.replaceChildren();
    this.meta().textContent = [explanation.provider, explanation.model].filter(Boolean).join(' · ');

    if (state.mode === 'translate') {
      const translation = document.createElement('p');
      translation.className = 'avs-popover-translation';
      translation.textContent = explanation.translation || 'No translation returned.';
      body.append(translation);
      return;
    }

    const fields: ReadonlyArray<readonly [string, string]> = [
      ['Translation', explanation.translation],
      ['Meaning', explanation.meaning],
      ['In plain words', explanation.simpleExplanation],
      ['Pronunciation', explanation.pronunciation],
      ['Grammar', explanation.grammar],
    ];
    for (const [label, value] of fields) {
      if (value.trim()) body.append(section(label, value));
    }

    const lists: ReadonlyArray<readonly [string, readonly string[]]> = [
      ['Examples', explanation.examples],
      ['Synonyms', explanation.synonyms],
      ['Antonyms', explanation.antonyms],
      ['Related words', explanation.relatedWords],
      ['Collocations', explanation.collocations],
    ];
    for (const [label, items] of lists) {
      if (items.length > 0) body.append(listSection(label, items));
    }
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

  private header(): HTMLElement {
    return this.element!.querySelector('.avs-popover-header')!;
  }

  private body(): HTMLElement {
    return this.element!.querySelector('.avs-popover-body')!;
  }

  private meta(): HTMLElement {
    return this.element!.querySelector('.avs-popover-meta')!;
  }
}

function section(label: string, value: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'avs-popover-section';
  const labelEl = document.createElement('div');
  labelEl.className = 'avs-popover-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('div');
  valueEl.textContent = value;
  wrapper.append(labelEl, valueEl);
  return wrapper;
}

function listSection(label: string, items: readonly string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'avs-popover-section';
  const labelEl = document.createElement('div');
  labelEl.className = 'avs-popover-label';
  labelEl.textContent = label;
  wrapper.append(labelEl);

  const list = document.createElement('ul');
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    list.append(li);
  }
  wrapper.append(list);
  return wrapper;
}
