import { isPhrase, detectLanguage } from '@/shared/lib/text';
import type { ExplainKind } from '@/shared/types/ai';
import type { Explanation } from '@/shared/types/vocabulary';
import { aiErrorMessage } from '@/ai/types';
import type { SelectionPayload } from '@/shared/messaging/contract';
import { readSelection } from './selection';
import { computePosition } from './hover-card';
import { sendMessage } from '@/shared/messaging/client';
import { toExplainUnit } from './explain-popover';
import {
  ICON_BOOK,
  ICON_BOOKMARK,
  ICON_COPY,
  ICON_FILE,
  ICON_LANGUAGES,
  ICON_MESSAGE,
  ICON_MINIMIZE,
  ICON_MORE,
  ICON_SPARKLES,
  ICON_WAND,
} from './icons';

const TOOLBAR_ID = 'avs-toolbar';
const MENU_ID = 'avs-assist-menu';
const OFFSET = 8;

/**
 * The unit of the current selection. Drives which explain prompt the
 * downstream popover uses (word vs phrase vs sentence vs paragraph).
 */
export type SelectionUnit = 'word' | 'phrase' | 'sentence' | 'paragraph';

export interface ToolbarState {
  /** Non-collapsed selected text, whitespace-collapsed. */
  text: string;
  /** Surrounding sentence of the selection, used as explain context. */
  sentence?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  /** Detected selection unit. */
  unit: SelectionUnit;
  /** Bounding rect of the selection range, viewport-relative. */
  rect: { top: number; bottom: number; left: number; width: number };
  /** Selection metadata captured when the toolbar opened, for saving. */
  selection?: SelectionPayload;
}


const TOOLBAR_ACTIONS = [
  { id: 'explain', label: 'Explain with AI', icon: ICON_SPARKLES },
  { id: 'simplify', label: 'Simplify', icon: ICON_MINIMIZE },
  { id: 'save', label: 'Save to Vocabulary', icon: ICON_BOOKMARK },
  { id: 'copy', label: 'Copy', icon: ICON_COPY },
  { id: 'more', label: 'More', icon: ICON_MORE },
] as const;

export type ToolbarActionId = (typeof TOOLBAR_ACTIONS)[number]['id'];

/** Every action the toolbar can emit. */
export type ToolbarAnyActionId = ToolbarActionId;

/** The smart-AI actions exposed on a translated/selected sentence. */
export type SmartAssistActionId =
  | 'explain-sentence'
  | 'explain-grammar'
  | 'explain-vocabulary'
  | 'simplify'
  | 'summarize'
  | 'examples'
  | 'native'
  | 'related'
  | 'save-difficult-words';

export interface SmartAssistAction {
  id: SmartAssistActionId;
  label: string;
  icon: string;
  /** Which analysis the ExplainService should produce. Absent = repository action. */
  kind?: ExplainKind;
}

export const SMART_ASSIST_ACTIONS: readonly SmartAssistAction[] = [
  { id: 'explain-sentence', label: 'Explain sentence', icon: ICON_MESSAGE, kind: 'sentence' },
  { id: 'explain-grammar', label: 'Explain grammar', icon: ICON_BOOK, kind: 'grammar' },
  { id: 'explain-vocabulary', label: 'Explain vocabulary', icon: ICON_SPARKLES, kind: 'vocabulary' },
  { id: 'simplify', label: 'Simplify', icon: ICON_MINIMIZE, kind: 'simplify' },
  { id: 'summarize', label: 'Summarize', icon: ICON_FILE, kind: 'summarize' },
  { id: 'examples', label: 'Give examples', icon: ICON_SPARKLES, kind: 'examples' },
  { id: 'native', label: 'Explain in my language', icon: ICON_LANGUAGES, kind: 'native' },
  { id: 'related', label: 'Generate related vocabulary', icon: ICON_WAND, kind: 'related' },
  { id: 'save-difficult-words', label: 'Save difficult words', icon: ICON_BOOKMARK },
];

/**
 * Classify a selection's text into a unit. Mirrors the existing `isPhrase`
 * heuristic but adds sentence/paragraph detection: a selection spanning more
 * than one sentence boundary is treated as a paragraph, a single multi-word
 * span as a phrase, etc.
 */
export function classifySelection(text: string): SelectionUnit {
  const collapsed = text.trim();
  if (!collapsed) return 'word';
  if (isPhrase(collapsed)) {
    const sentenceCount = (collapsed.match(/[.!?。！？]+(\s|$)/gu) ?? []).length;
    if (sentenceCount >= 2) return 'paragraph';
    if (sentenceCount === 1) return 'sentence';
    return 'phrase';
  }
  return 'word';
}

/** Read the current selection text + unit + viewport-rect, or null if empty. */
export function readToolbarSelection(doc: Document = document): ToolbarState | null {
  const selection = doc.getSelection();
  const text = (selection?.toString() ?? '').trim();
  if (!text || !selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  const payload = readSelection(doc);
  return {
    text,
    sentence: payload?.sentence ?? '',
    sourceUrl: payload?.sourceUrl ?? '',
    sourceTitle: payload?.sourceTitle ?? '',
    unit: classifySelection(text),
    rect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
    selection: readSelection(doc) ?? undefined,
  };
}

/** Compute a viewport-clamped position for the toolbar above the selection. */
export function computeToolbarPosition(
  anchor: { top: number; bottom: number; left: number; width: number },
  toolbar: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const center = anchor.left + anchor.width / 2;
  const maxLeft = Math.max(OFFSET, viewport.width - toolbar.width - OFFSET);
  const left = Math.min(Math.max(OFFSET, center - toolbar.width / 2), maxLeft);

  const above = anchor.top - OFFSET - toolbar.height;
  const top = above >= OFFSET ? above : anchor.bottom + OFFSET;

  return { top, left };
}

/**
 * Floating, ChatGPT/DeepL-style toolbar shown on text selection. Pure DOM (no
 * framework) so it can live inside the content-script IIFE bundle. Translation-
 * first: it shows the highlighted word and its keyless translation, with inline
 * Save + Simplify, and a "More" menu of AI actions that are greyed when no AI
 * provider key is configured. Emits CustomEvents (avs-toolbar-action /
 * avs-assist-action) that the content entry point routes to the message bus.
 */
export class SelectionToolbar {
  private element: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private buttons: HTMLButtonElement[] = [];
  private state: ToolbarState | null = null;
  private scrollHandler = (): void => this.reposition();

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;
    toolbar.className = 'avs-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-orientation', 'vertical');
    toolbar.setAttribute('aria-label', 'Text selection actions');
    toolbar.hidden = true;

    // Word + translation header (translation-first).
    const header = document.createElement('div');
    header.className = 'avs-toolbar-header';
    const word = document.createElement('span');
    word.className = 'avs-toolbar-word';
    word.dataset.role = 'word';
    const translation = document.createElement('span');
    translation.className = 'avs-toolbar-translation';
    translation.dataset.role = 'translation';
    translation.hidden = true;
    header.append(word, translation);
    toolbar.append(header);

    for (const action of TOOLBAR_ACTIONS) {
      // Hairline divider separating the primary actions from the More trigger.
      if (action.id === 'more') {
        const divider = document.createElement('div');
        divider.className = 'avs-toolbar-divider';
        divider.setAttribute('aria-hidden', 'true');
        toolbar.append(divider);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'avs-toolbar-btn';
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
      toolbar.append(button);
      if (action.id === 'more') {
        button.setAttribute('aria-haspopup', 'menu');
      }
    }

    toolbar.addEventListener('keydown', (event) => this.handleKeydown(event));
    document.body.append(toolbar);
    this.element = toolbar;
    return toolbar;
  }

  /**
   * Fetch the AI explanation for the current selection and render it inline in
   * the toolbar (no separate popover). Shows a loading state, then the structured
   * enrich data (meaning / translation / examples), or an error with a path to
   * Settings when no provider key is configured.
   */
  async showExplainInline(state: ToolbarState, kind: ExplainKind): Promise<void> {
    const toolbar = this.ensureElement();
    const body = this.ensureBody(toolbar);
    this.setExpanded(true);
    body.replaceChildren(this.statusRow('Asking the AI…'));
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
      body.replaceChildren(...this.renderExplanation(explanation, kind));
    } catch (cause) {
      const message = aiErrorMessage(cause);
      const frag = document.createDocumentFragment();
      frag.append(this.statusRow(message));
      if (/no ai provider|provider is configured|api key/i.test(message)) {
        const settings = document.createElement('button');
        settings.type = 'button';
        settings.className = 'avs-toolbar-explain-settings';
        settings.textContent = 'Open Settings';
        settings.addEventListener('click', () => {
          void sendMessage({ type: 'open-options' });
          this.hide();
        });
        frag.append(settings);
      }
      body.replaceChildren(frag);
    }
    this.reposition();
  }

  /** Lazily create the expandable explain body and return it. */
  private ensureBody(toolbar: HTMLElement): HTMLElement {
    if (this.body?.isConnected) return this.body;
    const body = document.createElement('div');
    body.className = 'avs-toolbar-body';
    body.hidden = true;
    toolbar.append(body);
    this.body = body;
    return body;
  }

  /** Show/hide the inline explain body and switch the toolbar to its expanded layout. */
  private setExpanded(expanded: boolean): void {
    if (!this.body) return;
    this.body.hidden = !expanded;
    this.element?.classList.toggle('avs-toolbar--expanded', expanded);
  }

  private statusRow(message: string): HTMLElement {
    const row = document.createElement('p');
    row.className = 'avs-toolbar-status';
    row.textContent = message;
    row.setAttribute('role', 'status');
    return row;
  }

  /** Render the structured AI explanation inline, driven by the analysis kind. */
  private renderExplanation(explanation: Explanation, kind: ExplainKind): HTMLElement[] {
    const rows: HTMLElement[] = [];
    const field = (label: string, value: string | undefined): void => {
      if (!value) return;
      const wrap = document.createElement('div');
      wrap.className = 'avs-toolbar-field';
      const l = document.createElement('span');
      l.className = 'avs-toolbar-field-label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'avs-toolbar-field-value';
      v.textContent = value;
      wrap.append(l, v);
      rows.push(wrap);
    };
    const list = (label: string, items: readonly string[] | undefined): void => {
      if (!items || items.length === 0) return;
      const wrap = document.createElement('div');
      wrap.className = 'avs-toolbar-field';
      const l = document.createElement('span');
      l.className = 'avs-toolbar-field-label';
      l.textContent = label;
      const ul = document.createElement('ul');
      ul.className = 'avs-toolbar-list';
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
    field('Part of speech', explanation.partOfSpeech);
    list('Examples', explanation.examples);
    list('Synonyms', explanation.synonyms);
    list('Related words', explanation.relatedWords);
    return rows;
  }
  private handleKeydown(event: KeyboardEvent): void {
    const current = event.target;
    if (!(current instanceof HTMLButtonElement) || !this.buttons.includes(current)) return;

    let next: HTMLButtonElement | undefined;
    const index = this.buttons.indexOf(current);
    if (event.key === 'ArrowDown') {
      next = this.buttons[index + 1] ?? this.buttons[0];
    } else if (event.key === 'ArrowUp') {
      next = this.buttons[index - 1] ?? this.buttons[this.buttons.length - 1];
    } else if (event.key === 'Home') {
      next = this.buttons[0];
    } else if (event.key === 'End') {
      next = this.buttons[this.buttons.length - 1];
    }
    if (!next || next === current) return;

    event.preventDefault();
    for (const button of this.buttons) button.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  }

  show(state: ToolbarState): void {
    this.state = state;
    const toolbar = this.ensureElement();
    this.buttons.forEach((button, index) => {
      button.tabIndex = index === 0 ? 0 : -1;
    });
    // Populate the word header and kick off the keyless auto-translation.
    const wordEl = toolbar.querySelector<HTMLElement>('[data-role="word"]');
    const translationEl = toolbar.querySelector<HTMLElement>('[data-role="translation"]');
    if (wordEl) wordEl.textContent = state.text;
    if (translationEl) {
      translationEl.hidden = false;
      translationEl.textContent = 'Translating…';
      void this.loadTranslation(state.text, translationEl);
    }
    toolbar.hidden = false;
    this.reposition();
    window.addEventListener('scroll', this.scrollHandler, true);
  }

  /** Fetch the keyless translation inline (no AI key needed). */
  private async loadTranslation(text: string, el: HTMLElement): Promise<void> {
    try {
      const result = await sendMessage({ type: 'translate', payload: { text } });
      if (result && result !== text) {
        el.textContent = result;
      } else {
        el.textContent = '—';
      }
      el.hidden = false;
    } catch {
      // Translation is best-effort; show a placeholder so the slot stays visible.
      el.textContent = '—';
      el.hidden = false;
    }
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
    const { top, left } = computeToolbarPosition(
      this.state.rect,
      { width, height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
  }
}

/**
 * Dropdown listing the six smart-AI actions on a selection. Opens anchored to
 * the selection toolbar; emits an `avs-assist-action` CustomEvent carrying the
 * action id and the full toolbar state, which the content entry point routes
 * to the ExplainService (or the repository for "Save difficult words").
 */
export class SmartAssistMenu {
  private element: HTMLElement | null = null;
  private state: ToolbarState | null = null;
  private trigger: HTMLElement | null = null;
  private aiAvailable = false;

  private onOutsidePointer = (event: MouseEvent): void => {
    if (event.target instanceof Node && !this.element?.contains(event.target)) this.hide(false);
  };
  private onScroll = (): void => this.hide(false);
  private onKeydown = (event: KeyboardEvent): void => {
    const items = this.menuItems();
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      this.hide();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'avs-assist-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Smart AI assistance');
    menu.hidden = true;

    for (const action of SMART_ASSIST_ACTIONS) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'avs-assist-item';
      item.setAttribute('role', 'menuitem');
      item.dataset.action = action.id;
      item.setAttribute('aria-label', action.label);
      // AI analyses require a provider key; grey them out when none is set.
      if (action.kind && !this.aiAvailable) {
        item.classList.add('avs-assist-item--disabled');
        item.disabled = true;
        item.title = 'AI actions need an API key in settings';
      }

      const icon = document.createElement('span');
      icon.className = 'avs-assist-icon';
      icon.innerHTML = action.icon;
      const label = document.createElement('span');
      label.textContent = action.label;

      item.append(icon, label);
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = this.state;
        this.hide();
        if (current) {
          document.dispatchEvent(
            new CustomEvent('avs-assist-action', {
              detail: { action: action.id, state: current },
            }),
          );
        }
      });
      menu.append(item);
    }

    document.body.append(menu);
    this.element = menu;
    return menu;
  }

  toggle(state: ToolbarState, aiAvailable = true): void {
    if (this.isVisible && this.state?.text === state.text) {
      this.hide();
      return;
    }
    this.aiAvailable = aiAvailable;
    const menu = this.ensureElement();
    this.state = state;
    this.trigger =
      document.querySelector<HTMLElement>('[data-action="more"]') ??
      (document.activeElement as HTMLElement | null);
    menu.hidden = false;
    this.position(menu);
    this.menuItems()[0]?.focus();

    document.addEventListener('mousedown', this.onOutsidePointer, true);
    window.addEventListener('scroll', this.onScroll, true);
    menu.addEventListener('keydown', this.onKeydown);
  }

  hide(restoreFocus = true): void {
    if (this.element) this.element.hidden = true;
    if (restoreFocus) this.trigger?.focus();
    this.trigger = null;
    this.state = null;
    document.removeEventListener('mousedown', this.onOutsidePointer, true);
    window.removeEventListener('scroll', this.onScroll, true);
    this.element?.removeEventListener('keydown', this.onKeydown);
  }

  get isVisible(): boolean {
    return !!this.element?.isConnected && !this.element.hidden;
  }

  destroy(): void {
    this.hide(false);
    this.element?.remove();
    this.element = null;
  }

  private menuItems(): HTMLElement[] {
    return Array.from(this.element?.querySelectorAll<HTMLElement>('.avs-assist-item') ?? []);
  }

  /** Anchor the menu to the toolbar, flipping above when there is no room below. */
  private position(menu: HTMLElement): void {
    const toolbar = document.getElementById(TOOLBAR_ID);
    const anchor = toolbar?.getBoundingClientRect() ?? this.state?.rect;
    if (!anchor) return;
    const { width, height } = menu.getBoundingClientRect();
    const { top, left } = computePosition(
      anchor,
      { width, height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }
}
