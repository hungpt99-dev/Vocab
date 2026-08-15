import { sendMessage } from '@/shared/messaging/client';
import { showToast } from './toast';
import type { HighlightData } from '@/shared/messaging/contract';

type RadarItem = HighlightData['radar'][number];

/**
 * Compact action card shown when the user hovers/clicks a Radar-highlighted word
 * on a page. Radar words are generated candidates (not yet saved), so the only
 * action is to promote the word into Saved Vocabulary — which removes it from
 * Radar. No AI call happens here.
 */
export class RadarCard {
  private element: HTMLElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  show(anchor: HTMLElement, item: RadarItem): void {
    this.cancelHide();
    this.hide();

    const card = document.createElement('div');
    card.className = 'avs-card avs-radar-card';
    card.setAttribute('role', 'dialog');

    const word = document.createElement('div');
    word.className = 'avs-radar-card__word';
    word.textContent = item.word;
    card.appendChild(word);

    const related = document.createElement('div');
    related.className = 'avs-radar-card__related';
    const sources = item.sourceWords.filter(Boolean);
    related.textContent = sources.length
      ? `Related to: ${sources.join(', ')}`
      : 'From your Radar';
    card.appendChild(related);

    if (item.reason) {
      const reason = document.createElement('div');
      reason.className = 'avs-radar-card__reason';
      reason.textContent = item.reason;
      card.appendChild(reason);
    }

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'avs-radar-card__save';
    save.textContent = 'Save to Vocabulary';
    save.addEventListener('click', (event) => {
      event.stopPropagation();
      void this.save(item);
    });
    card.appendChild(save);

    document.body.appendChild(card);
    this.element = card;
    this.position(card, anchor);

    card.addEventListener('mouseenter', () => this.cancelHide());
    card.addEventListener('mouseleave', () => this.scheduleHide(200));
  }

  private async save(item: RadarItem): Promise<void> {
    try {
      await sendMessage({
        type: 'radar:save',
        payload: {
          word: item.word,
          wordKey: item.wordKey,
          sourceLanguage: '',
        },
      });
      showToast(`Saved "${item.word}" to Vocabulary`, 'success');
      this.hide();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save that word.', 'error');
    }
  }

  private position(card: HTMLElement, anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const top = rect.bottom + 8;
    let left = rect.left;
    // Keep the card within the viewport horizontally.
    const maxLeft = window.innerWidth - card.offsetWidth - 12;
    if (left > maxLeft) left = Math.max(12, maxLeft);
    card.style.position = 'fixed';
    card.style.top = `${Math.min(top, window.innerHeight - card.offsetHeight - 12)}px`;
    card.style.left = `${left}px`;
    card.style.zIndex = '2147483647';
  }

  contains(node: Node): boolean {
    return Boolean(this.element?.contains(node));
  }

  scheduleHide(delay: number): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.hide(), delay);
  }

  private cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }

  hide(): void {
    this.element?.remove();
    this.element = null;
  }
}
