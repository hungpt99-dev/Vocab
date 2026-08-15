import type { HighlightEntry } from './matcher';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PronunciationButton } from '@/features/pronunciation/PronunciationButton';

const CARD_ID = 'avs-hover-card';
const OFFSET = 10;

/** Which sections of the hover card are visible. */
export interface HoverCardOptions {
  showOriginal?: boolean;
  showTranslation?: boolean;
}

const DEFAULT_OPTIONS: HoverCardOptions = { showOriginal: true, showTranslation: true };

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
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private speakerRoot: Root | null = null;

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
    this.disposeSpeaker();
    this.element?.remove();
    this.element = null;
  }

  private render(entry: HighlightEntry, options: HoverCardOptions = DEFAULT_OPTIONS): void {
    if (!this.element) return;
    this.disposeSpeaker();
    this.element.replaceChildren(...renderContent(entry, options));

    // Mount the reusable PronunciationButton (same component/icon/font as the
    // React UIs) into a host so the on-page card can speak the word too.
    const host = this.element.querySelector<HTMLElement>('.avs-card-speaker');
    if (host && entry.word) {
      this.speakerRoot = createRoot(host);
      this.speakerRoot.render(
        createElement(PronunciationButton, {
          word: entry.word,
          language: entry.sourceLanguage ?? '',
          className: 'avs-card-speaker-btn',
        }),
      );
    }
  }

  private disposeSpeaker(): void {
    if (this.speakerRoot) {
      this.speakerRoot.unmount();
      this.speakerRoot = null;
    }
  }
}

function renderContent(entry: HighlightEntry, options: HoverCardOptions): HTMLElement[] {
  const nodes: HTMLElement[] = [];

  if (options.showOriginal) {
    const wordRow = document.createElement('div');
    wordRow.className = 'avs-card-word-row';

    const word = document.createElement('div');
    word.className = 'avs-card-word';
    word.textContent = entry.word;
    wordRow.append(word);

    // Host for the React PronunciationButton (speaker). The button disables
    // itself when speech is unsupported or the language is unknown, so it is
    // safe to always mount.
    const speaker = document.createElement('div');
    speaker.className = 'avs-card-speaker';
    speaker.setAttribute('role', 'presentation');
    wordRow.append(speaker);

    nodes.push(wordRow);
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
    nodes.push(row('Meaning', entry.meaning || 'No explanation yet.'));
  }

  if (entry.note) nodes.push(row('Note', entry.note));
  nodes.push(row('Saved', formatSavedDate(entry.createdAt)));

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
