import type { HighlightEntry } from './matcher';

const CARD_ID = 'avs-hover-card';
const OFFSET = 10;

/** Which sections of the hover card are visible. */
export interface HoverCardOptions {
  showOriginal?: boolean;
  showTranslation?: boolean;
}

const DEFAULT_OPTIONS: HoverCardOptions = { showOriginal: true, showTranslation: true };

/** Custom event dispatched when a card shortcut is activated. */
export const CARD_ACTION_EVENT = 'avs-card-action';

export interface CardActionDetail {
  action: 'explain';
  entry: HighlightEntry;
}

/** Format an epoch timestamp for display in the hover card. */
export function formatSavedDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Compute a viewport-clamped position for the card, flipping above the anchor
 * when there is not enough space below.
 */
export function computePosition(
  anchor: { top: number; bottom: number; left: number },
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const fitsBelow = anchor.bottom + OFFSET + card.height <= viewport.height;
  const top = fitsBelow ? anchor.bottom + OFFSET : Math.max(OFFSET, anchor.top - OFFSET - card.height);
  const maxLeft = Math.max(OFFSET, viewport.width - card.width - OFFSET);
  const left = Math.min(Math.max(OFFSET, anchor.left), maxLeft);
  return { top, left };
}

/** Accessible tooltip showing the meaning, pronunciation, note and an AI shortcut. */
export class HoverCard {
  private element: HTMLElement | null = null;
  private explaining = false;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const card = document.createElement('div');
    card.id = CARD_ID;
    card.className = 'avs-card';
    card.setAttribute('role', 'tooltip');
    card.hidden = true;
    document.body.append(card);
    this.element = card;

    // Keep the card open while the cursor is over it, and defer closing when it
    // leaves so the user can cross the gap to reach the card before it vanishes.
    card.addEventListener('mouseenter', () => this.cancelHide());
    card.addEventListener('mouseleave', () => this.scheduleHide());
    return card;
  }

  show(anchor: HTMLElement, entry: HighlightEntry, options: HoverCardOptions = DEFAULT_OPTIONS): void {
    this.cancelHide();
    this.explaining = false;

    const card = this.ensureElement();
    this.render(entry, options);
    card.hidden = false;

    anchor.setAttribute('aria-describedby', CARD_ID);

    const anchorRect = anchor.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const { top, left } = computePosition(
      anchorRect,
      { width: cardRect.width, height: cardRect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  }

  /** True when the node lives inside the card, so it can keep itself open. */
  contains(node: Node): boolean {
    return !!this.element?.isConnected && this.element.contains(node);
  }

  /** Re-render with freshly fetched information, keeping the card open. */
  update(entry: HighlightEntry): void {
    if (!this.element || this.element.hidden) return;
    this.render(entry);
  }

  /** Toggle the loading state of the AI-explain shortcut. */
  setExplaining(explaining: boolean): void {
    this.explaining = explaining;
    const button = this.element?.querySelector<HTMLButtonElement>('.avs-card-explain');
    if (button) {
      button.disabled = explaining;
      button.textContent = explaining ? 'Explaining…' : 'AI explain';
    }
  }

  hide(anchor?: HTMLElement): void {
    anchor?.removeAttribute('aria-describedby');
    if (this.element) this.element.hidden = true;
  }

  scheduleHide(delay = 160): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.hide(), delay);
  }

  private cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }

  destroy(): void {
    this.cancelHide();
    this.element?.remove();
    this.element = null;
  }

  private render(entry: HighlightEntry, options: HoverCardOptions = DEFAULT_OPTIONS): void {
    if (!this.element) return;
    this.element.replaceChildren(...renderContent(entry, this.explaining, options));
  }
}

function renderContent(entry: HighlightEntry, explaining: boolean, options: HoverCardOptions): HTMLElement[] {
  const nodes: HTMLElement[] = [];

  if (options.showOriginal) {
    const word = document.createElement('div');
    word.className = 'avs-card-word';
    word.textContent = entry.word;
    nodes.push(word);
  }

  const explanation = entry.explanation;
  if (explanation) {
    if (explanation.pronunciation) nodes.push(row('Pronunciation', explanation.pronunciation));
    if (explanation.partOfSpeech || explanation.grammar) {
      const bits = [explanation.partOfSpeech, explanation.grammar].filter(Boolean).join(' · ');
      nodes.push(row('Grammar', bits));
    }
    if (options.showTranslation) {
      nodes.push(row('Meaning', explanation.meaning || '—'));
    }
    if (explanation.simpleExplanation && explanation.simpleExplanation !== explanation.meaning) {
      nodes.push(row('In short', explanation.simpleExplanation));
    }
    if (explanation.translation) nodes.push(row('Translation', explanation.translation));
    if (explanation.register) nodes.push(row('Register', explanation.register));
    if (explanation.etymology) nodes.push(row('Etymology', explanation.etymology));
    if (explanation.examples?.length) nodes.push(list('Examples', explanation.examples));
    if (explanation.synonyms?.length) nodes.push(list('Synonyms', explanation.synonyms));
    if (explanation.antonyms?.length) nodes.push(list('Antonyms', explanation.antonyms));
    if (explanation.collocations?.length) nodes.push(list('Collocations', explanation.collocations));
    if (explanation.relatedPhrases?.length) nodes.push(list('Related phrases', explanation.relatedPhrases));
  } else if (options.showTranslation) {
    if (entry.pronunciation) nodes.push(row('Pronunciation', entry.pronunciation));
    nodes.push(row('Meaning', entry.meaning || 'No explanation yet — use AI explain below.'));
  }

  if (entry.note) nodes.push(row('Note', entry.note));
  nodes.push(row('Saved', formatSavedDate(entry.createdAt)));

  const explain = document.createElement('button');
  explain.type = 'button';
  explain.className = 'avs-card-explain';
  explain.textContent = explaining ? 'Explaining…' : 'AI explain';
  explain.disabled = explaining;
  explain.setAttribute('aria-label', `Explain "${entry.word}" with AI`);
  explain.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.dispatchEvent(
      new CustomEvent<CardActionDetail>(CARD_ACTION_EVENT, {
        detail: { action: 'explain', entry },
      }),
    );
  });
  nodes.push(explain);

  return nodes;
}

function list(label: string, items: string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'avs-card-row';
  const labelEl = document.createElement('div');
  labelEl.className = 'avs-card-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('ul');
  valueEl.className = 'avs-card-list';
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    valueEl.append(li);
  }
  wrapper.append(labelEl, valueEl);
  return wrapper;
}

function row(label: string, value: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'avs-card-row';

  const labelEl = document.createElement('div');
  labelEl.className = 'avs-card-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('div');
  valueEl.textContent = value;

  wrapper.append(labelEl, valueEl);
  return wrapper;
}
