import { computePosition } from '../hover-card';

const POPOVER_ID = 'avs-word-gloss';
const HIDE_DELAY = 160;

/**
 * Lightweight popover shown when the reader hovers a `.avs-gloss-word` span in
 * bilingual word mode. It reveals the target-language gloss for that single
 * word without cluttering the page. The 160ms grace period (and keep-open on
 * card hover) is reused from the vocabulary HoverCard so the reader can move
 * across the gap onto the popover.
 */
export class WordGlossPopover {
  private element: HTMLElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const popover = document.createElement('div');
    popover.id = POPOVER_ID;
    popover.className = 'avs-word-gloss';
    popover.setAttribute('role', 'tooltip');
    popover.hidden = true;
    document.body.append(popover);
    this.element = popover;

    popover.addEventListener('mouseenter', () => this.cancelHide());
    popover.addEventListener('mouseleave', () => this.scheduleHide());
    return popover;
  }

  show(anchor: HTMLElement): void {
    const target = anchor.dataset.avsGloss;
    if (!target) return;
    this.cancelHide();

    const popover = this.ensureElement();
    popover.replaceChildren(...this.render(anchor.textContent ?? '', target));
    popover.hidden = false;

    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const { top, left } = computePosition(
      anchorRect,
      { width: popoverRect.width, height: popoverRect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  contains(node: Node): boolean {
    return !!this.element?.isConnected && this.element.contains(node);
  }

  scheduleHide(delay = HIDE_DELAY): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.hide(), delay);
  }

  private cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }

  private hide(): void {
    if (this.element) this.element.hidden = true;
  }

  destroy(): void {
    this.cancelHide();
    this.element?.remove();
    this.element = null;
  }

  private render(source: string, target: string): HTMLElement[] {
    const nodes: HTMLElement[] = [];

    const word = document.createElement('div');
    word.className = 'avs-word-gloss-word';
    word.textContent = source;
    nodes.push(word);

    const gloss = document.createElement('div');
    gloss.className = 'avs-word-gloss-target';
    gloss.textContent = target;
    nodes.push(gloss);

    return nodes;
  }
}
