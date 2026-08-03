import type { Explanation } from '@/shared/types/vocabulary';
import { ICON_CLOSE } from './icons';

const POPOVER_ID = 'avs-popover';
const OFFSET = 8;

/** Viewport-relative rectangle the popover is anchored to. */
export interface PopoverAnchor {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

/** Result rendered inside the popover, one variant per toolbar action. */
export type PopoverResult =
  { kind: 'explain'; explanation: Explanation } | { kind: 'translate'; translation: string };

export interface SelectionPopoverOptions {
  title: string;
  load: () => Promise<PopoverResult>;
  anchor: PopoverAnchor;
}

/**
 * Compute a viewport-clamped position placing the popover below the anchor,
 * flipping above when there is not enough room (mirrors the hover card).
 */
export function computePopoverPosition(
  anchor: PopoverAnchor,
  popover: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const fitsBelow = anchor.bottom + OFFSET + popover.height <= viewport.height;
  const top = fitsBelow
    ? anchor.bottom + OFFSET
    : Math.max(OFFSET, anchor.top - OFFSET - popover.height);
  const maxLeft = Math.max(OFFSET, viewport.width - popover.width - OFFSET);
  const left = Math.min(Math.max(OFFSET, anchor.left), maxLeft);
  return { top, left };
}

/** Build a DOM element with a class name and optional text content. */
function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Floating panel that runs a toolbar action against the message bus and shows
 * the result (an AI explanation or a translation). Pure DOM so it can live in
 * the content-script IIFE bundle. Dismissed with Escape, outside click or the
 * close button. All AI work happens in the service worker, so the content
 * script stays provider-agnostic.
 */
export class SelectionPopover {
  private element: HTMLElement | null = null;

  private readonly keydownHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.hide();
  };

  private readonly outsideHandler = (event: MouseEvent): void => {
    if (event.target instanceof Node && !this.element?.contains(event.target)) this.hide();
  };

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const popover = document.createElement('div');
    popover.id = POPOVER_ID;
    popover.className = 'avs-popover';
    popover.setAttribute('role', 'dialog');
    popover.hidden = true;
    document.body.append(popover);
    this.element = popover;
    return popover;
  }

  async show(options: SelectionPopoverOptions): Promise<void> {
    const popover = this.ensureElement();
    popover.hidden = false;
    popover.setAttribute('aria-label', options.title);
    popover.replaceChildren(...buildLoading(options.title, () => this.hide()));
    this.position(popover, options.anchor);

    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('mousedown', this.outsideHandler);

    try {
      const result = await options.load();
      if (!this.isVisible) return; // dismissed while the request was in flight
      popover.replaceChildren(...buildResult(options.title, () => this.hide(), result));
      this.position(popover, options.anchor); // height changed; re-clamp
    } catch (error) {
      if (!this.isVisible) return;
      const message = error instanceof Error ? error.message : 'The request failed.';
      popover.replaceChildren(...buildError(options.title, () => this.hide(), message));
      this.position(popover, options.anchor);
    }
  }

  hide(): void {
    if (!this.element) return;
    this.element.hidden = true;
    document.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('mousedown', this.outsideHandler);
  }

  get isVisible(): boolean {
    return !!this.element?.isConnected && !this.element.hidden;
  }

  destroy(): void {
    this.hide();
    this.element?.remove();
    this.element = null;
  }

  private position(popover: HTMLElement, anchor: PopoverAnchor): void {
    const rect = popover.getBoundingClientRect();
    const { top, left } = computePopoverPosition(
      anchor,
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }
}

function buildHeader(title: string, onClose: () => void): HTMLElement {
  const header = el('div', 'avs-popover-header');

  const heading = el('span', 'avs-popover-title', title);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'avs-popover-close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = ICON_CLOSE;
  close.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  });

  header.append(heading, close);
  return header;
}

function buildLoading(title: string, onClose: () => void): HTMLElement[] {
  const status = el('div', 'avs-popover-status', `${title}…`);
  status.setAttribute('role', 'status');
  return [buildHeader(title, onClose), status];
}

function buildError(title: string, onClose: () => void, message: string): HTMLElement[] {
  const error = el('div', 'avs-popover-error', message);
  error.setAttribute('role', 'alert');
  return [buildHeader(title, onClose), error];
}

function buildResult(title: string, onClose: () => void, result: PopoverResult): HTMLElement[] {
  const body = el('div', 'avs-popover-body');
  if (result.kind === 'translate') {
    body.textContent = result.translation || 'No translation was returned.';
  } else {
    body.replaceChildren(...renderExplanation(result.explanation));
  }
  return [buildHeader(title, onClose), body];
}

function renderExplanation(explanation: Explanation): HTMLElement[] {
  const nodes: HTMLElement[] = [];

  const meaning = el('p', 'avs-popover-meaning', explanation.meaning);
  nodes.push(meaning);

  if (explanation.pronunciation) {
    nodes.push(el('p', 'avs-popover-pronunciation', explanation.pronunciation));
  }
  if (explanation.simpleExplanation && explanation.simpleExplanation !== explanation.meaning) {
    nodes.push(el('p', 'avs-popover-simple', explanation.simpleExplanation));
  }

  if (explanation.translation) {
    nodes.push(section('Translation', [explanation.translation]));
  }
  nodes.push(...listSection('Examples', explanation.examples));
  nodes.push(...listSection('Synonyms', explanation.synonyms));
  nodes.push(...listSection('Collocations', explanation.collocations));

  return nodes;
}

function listSection(label: string, items: readonly string[]): HTMLElement[] {
  return items.length === 0 ? [] : [section(label, items)];
}

function section(label: string, items: readonly string[]): HTMLElement {
  const wrapper = el('div', 'avs-popover-section');
  wrapper.append(el('div', 'avs-popover-label', label));

  const list = document.createElement('ul');
  list.className = 'avs-popover-list';
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    list.append(li);
  }
  wrapper.append(list);
  return wrapper;
}
