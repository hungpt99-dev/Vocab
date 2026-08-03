import type { Explanation } from '@/shared/types/vocabulary';
import type { ToolbarState } from './toolbar';
import { computePosition } from './hover-card';
import { ICON_CLOSE } from './icons';

const PANEL_ID = 'avs-panel';

/**
 * Dismissible overlay showing the result of a smart-AI analysis (explain
 * sentence/grammar/vocabulary, simplify, summarize). Pure DOM, like the rest
 * of the content script, and dismissible with Escape or an outside click.
 */
export class ExplainPanel {
  private element: HTMLElement | null = null;
  private previousFocus: HTMLElement | null = null;

  private onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.hide();
  };
  private onOutsidePointer = (event: MouseEvent): void => {
    if (event.target instanceof Node && !this.element?.contains(event.target)) this.hide();
  };

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'avs-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'AI explanation');
    panel.hidden = true;
    document.body.append(panel);
    this.element = panel;
    return panel;
  }

  show(label: string, state: ToolbarState, explanation: Explanation): void {
    const panel = this.ensureElement();
    this.previousFocus = document.activeElement as HTMLElement | null;
    panel.replaceChildren(...renderExplanation(label, state, explanation, () => this.hide()));
    panel.hidden = false;
    this.position(panel, state);

    panel.querySelector<HTMLButtonElement>('.avs-panel-close')?.focus();
    document.addEventListener('keydown', this.onKeydown, true);
    document.addEventListener('mousedown', this.onOutsidePointer, true);
  }

  hide(): void {
    if (this.element) this.element.hidden = true;
    this.previousFocus?.focus();
    this.previousFocus = null;
    document.removeEventListener('keydown', this.onKeydown, true);
    document.removeEventListener('mousedown', this.onOutsidePointer, true);
  }

  get isVisible(): boolean {
    return !!this.element?.isConnected && !this.element.hidden;
  }

  destroy(): void {
    this.hide();
    this.element?.remove();
    this.element = null;
  }

  private position(panel: HTMLElement, state: ToolbarState): void {
    const { width, height } = panel.getBoundingClientRect();
    const { top, left } = computePosition(
      state.rect,
      { width, height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  }
}

function renderExplanation(
  label: string,
  state: ToolbarState,
  explanation: Explanation,
  onClose: () => void,
): HTMLElement[] {
  const nodes: HTMLElement[] = [];

  const header = document.createElement('div');
  header.className = 'avs-panel-header';

  const title = document.createElement('span');
  title.className = 'avs-panel-title';
  title.textContent = label;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'avs-panel-close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = ICON_CLOSE;
  close.addEventListener('click', onClose);

  header.append(title, close);
  nodes.push(header);

  const source = document.createElement('p');
  source.className = 'avs-panel-source';
  source.textContent = state.text;
  nodes.push(source);

  nodes.push(row('Meaning', explanation.meaning));
  if (explanation.simpleExplanation && explanation.simpleExplanation !== explanation.meaning) {
    nodes.push(row('In simple words', explanation.simpleExplanation));
  }
  if (explanation.grammar) nodes.push(row('Grammar', explanation.grammar));
  if (explanation.relatedWords.length > 0) {
    nodes.push(list('Key vocabulary', explanation.relatedWords));
  }
  if (explanation.translation) nodes.push(row('Translation', explanation.translation));
  if (explanation.examples.length > 0) nodes.push(list('Examples', explanation.examples));

  const footer = document.createElement('p');
  footer.className = 'avs-panel-footer';
  footer.textContent = explanation.provider
    ? `${explanation.provider}${explanation.model ? ` · ${explanation.model}` : ''}`
    : '';
  nodes.push(footer);

  return nodes;
}

function row(label: string, value: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'avs-panel-row';

  const labelEl = document.createElement('div');
  labelEl.className = 'avs-panel-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('div');
  valueEl.textContent = value;

  wrapper.append(labelEl, valueEl);
  return wrapper;
}

function list(label: string, items: readonly string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'avs-panel-row';

  const labelEl = document.createElement('div');
  labelEl.className = 'avs-panel-label';
  labelEl.textContent = label;

  const ul = document.createElement('ul');
  ul.className = 'avs-panel-list';
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    ul.append(li);
  }

  wrapper.append(labelEl, ul);
  return wrapper;
}
