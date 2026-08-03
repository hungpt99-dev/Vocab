import type { ExplainRequest, ExplainUnit } from '@/shared/types/explain';
import type { Explanation } from '@/shared/types/vocabulary';
import { detectLanguage } from '@/shared/lib/text';
import { aiErrorMessage } from '@/ai/types';
import { sendMessage } from '@/shared/messaging/client';
import { computePosition } from './hover-card';
import type { SelectionUnit } from './toolbar';
import { ICON_CLOSE } from './icons';

const POPOVER_ID = 'avs-explain';

/** Explain the current selection via the background worker; never a provider directly. */
export type ExplainFn = (request: ExplainRequest) => Promise<Explanation>;

export interface ExplainPopoverInput {
  /** Selected text, whitespace-collapsed. */
  text: string;
  /** Selection unit classified by the toolbar. */
  unit: SelectionUnit;
  /** Bounding rect of the selection, viewport-relative. */
  rect: { top: number; bottom: number; left: number; width: number };
  /** Surrounding paragraph/sentence the selection appeared in. */
  context: string;
  /** Source page URL. */
  sourceUrl: string;
  /** Source page title. */
  sourceTitle: string;
}

/** Map a toolbar classification to the units the explainer supports. */
export function toExplainUnit(unit: SelectionUnit): ExplainUnit {
  switch (unit) {
    case 'phrase':
      return 'phrase';
    case 'sentence':
    case 'paragraph':
      return 'sentence';
    default:
      return 'word';
  }
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function buttonElement(className: string, text?: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.className = className;
  el.type = 'button';
  if (text !== undefined) el.textContent = text;
  return el;
}

/** An expandable `<details>` section, empty for empty values. */
function sectionText(label: string, value: string | undefined, open = false): HTMLDetailsElement | null {
  if (!value) return null;
  const details = document.createElement('details');
  details.className = 'avs-explain-section';
  details.open = open;
  const summary = element('summary', 'avs-explain-section-summary', label);
  details.append(summary, element('p', 'avs-explain-value', value));
  return details;
}

function sectionList(
  label: string,
  items: readonly string[] | undefined,
  open = false,
): HTMLDetailsElement | null {
  if (!items || items.length === 0) return null;
  const details = document.createElement('details');
  details.className = 'avs-explain-section';
  details.open = open;
  const summary = element('summary', 'avs-explain-section-summary', label);
  const list = document.createElement('ul');
  list.className = 'avs-explain-list';
  for (const item of items) {
    list.append(element('li', 'avs-explain-item', item));
  }
  details.append(summary, list);
  return details;
}

/** Structured fields rendered per unit, per the explainer spec. */
function buildSections(unit: ExplainUnit, explanation: Explanation): HTMLElement[] {
  const sections: HTMLElement[] = [];
  const push = (section: HTMLElement | null): void => {
    if (section) sections.push(section);
  };

  switch (unit) {
    case 'phrase':
      push(sectionText('Explanation', explanation.meaning, true));
      push(sectionText('Translation', explanation.translation));
      push(sectionText('Grammar', explanation.grammar));
      push(sectionText('Usage', explanation.usage));
      push(sectionList('Examples', explanation.examples));
      break;
    case 'sentence':
      push(sectionText('Summary', explanation.summary || explanation.meaning, true));
      push(sectionText('Translation', explanation.translation));
      push(sectionText('Grammar', explanation.grammar));
      push(sectionList('Difficult vocabulary', explanation.difficultVocabulary));
      break;
    default:
      push(sectionText('Meaning', explanation.meaning, true));
      push(sectionText('Pronunciation', explanation.pronunciation));
      push(sectionText('Translation', explanation.translation));
      push(sectionText('Part of speech', explanation.partOfSpeech));
      push(sectionList('Examples', explanation.examples));
      push(sectionList('Synonyms', explanation.synonyms));
      push(sectionList('Antonyms', explanation.antonyms));
      push(sectionList('Collocations', explanation.collocations));
      push(sectionList('Related words', explanation.relatedWords));
  }
  return sections;
}

/**
 * Floating "Explain with AI" popover shown from the selection toolbar. Pure DOM
 * (no framework) so it can live inside the content-script IIFE bundle. The AI
 * is called ONLY when the user clicks Explain — opening the popover never fires
 * a request.
 */
export class ExplainPopover {
  private element: HTMLElement | null = null;
  private input: ExplainPopoverInput | null = null;

  constructor(private readonly explainFn: ExplainFn) {}

  show(input: ExplainPopoverInput): void {
    this.input = input;
    const popover = this.ensureElement();
    popover.replaceChildren(...this.renderInitial(input));
    popover.hidden = false;
    this.position(popover, input.rect);
    popover.querySelector<HTMLButtonElement>('[data-action="explain"]')?.focus();
  }

  hide(): void {
    if (this.element) this.element.hidden = true;
    this.input = null;
  }

  get isVisible(): boolean {
    return !!this.element?.isConnected && !this.element.hidden;
  }

  destroy(): void {
    this.element?.remove();
    this.element = null;
    this.input = null;
  }

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const popover = document.createElement('div');
    popover.id = POPOVER_ID;
    popover.className = 'avs-explain';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Explain with AI');
    popover.hidden = true;
    popover.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.hide();
    });
    document.body.append(popover);
    this.element = popover;
    return popover;
  }

  private renderInitial(input: ExplainPopoverInput): HTMLElement[] {
    const header = element('div', 'avs-explain-header');
    header.append(
      element('span', 'avs-explain-title', input.text),
      element('span', 'avs-explain-unit', input.unit),
    );
    const close = buttonElement('avs-explain-close');
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = ICON_CLOSE;
    close.addEventListener('click', () => this.hide());
    header.append(close);

    const hint = element(
      'p',
      'avs-explain-hint',
      `Explain this ${input.unit} using your configured AI provider.`,
    );

    const explain = buttonElement('avs-explain-btn', 'Explain');
    explain.dataset.action = 'explain';
    explain.setAttribute('aria-label', 'Explain this selection with AI');
    explain.addEventListener('click', () => void this.runExplain());

    return [header, hint, explain];
  }

  private async runExplain(): Promise<void> {
    const input = this.input;
    if (!input || !this.element) return;
    const popover = this.element;
    const status = element('p', 'avs-explain-status', 'Asking the AI…');
    status.setAttribute('role', 'status');

    const button = popover.querySelector<HTMLButtonElement>('[data-action="explain"]');
    if (button) button.replaceWith(status);

    const unit = toExplainUnit(input.unit);
    try {
      const explanation = await this.explainFn({
        word: input.text,
        unit,
        context: input.context,
        sourceUrl: input.sourceUrl,
        sourceTitle: input.sourceTitle,
        sourceLanguage: detectLanguage(input.text),
      });
      status.remove();
      popover.querySelector('.avs-explain-hint')?.remove();
      const sections = buildSections(unit, explanation);
      const meta = element(
        'p',
        'avs-explain-meta',
        `${explanation.provider}${explanation.model ? ` · ${explanation.model}` : ''}`,
      );
      popover.append(...sections, meta);
    } catch (cause) {
      const message = aiErrorMessage(cause);
      const error = element('p', 'avs-explain-error', message);
      error.setAttribute('role', 'alert');
      const retry = buttonElement('avs-explain-btn', 'Try again');
      retry.dataset.action = 'explain';
      retry.setAttribute('aria-label', 'Retry the AI explanation');
      retry.addEventListener('click', () => void this.runExplain());
      const actions: HTMLElement[] = [error, retry];
      // When no provider is configured, offer a direct path to Settings.
      if (/no ai provider|provider is configured|api key/i.test(message)) {
        const settings = buttonElement('avs-explain-settings', 'Open Settings');
        settings.addEventListener('click', () => {
          void sendMessage({ type: 'open-options' });
          this.hide();
        });
        actions.push(settings);
      }
      status.replaceWith(...actions);
    }
  }

  private position(popover: HTMLElement, rect: ExplainPopoverInput['rect']): void {
    const { width, height } = popover.getBoundingClientRect();
    const { top, left } = computePosition(
      rect,
      { width, height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }
}
