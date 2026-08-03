import { isPhrase } from '@/shared/lib/text';
import type { ExplainKind } from '@/shared/types/ai';
import type { SelectionPayload } from '@/shared/messaging/contract';
import { readSelection } from './selection';
import { computePosition } from './hover-card';
import {
  ICON_BOOK,
  ICON_BOOKMARK,
  ICON_BOOK_OPEN,
  ICON_COPY,
  ICON_FILE,
  ICON_LANGUAGES,
  ICON_MESSAGE,
  ICON_MINIMIZE,
  ICON_MORE,
  ICON_SPARKLES,
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
  { id: 'translate', label: 'Translate', icon: ICON_LANGUAGES },
  { id: 'save', label: 'Save to Vocabulary', icon: ICON_BOOKMARK },
  { id: 'copy', label: 'Copy', icon: ICON_COPY },
  { id: 'more', label: 'More', icon: ICON_MORE },
] as const;

export type ToolbarActionId = (typeof TOOLBAR_ACTIONS)[number]['id'];

/** Actions hidden behind the 'More' trigger (e.g. reading-mode entry). */
const TOOLBAR_MENU_ACTIONS = [{ id: 'reading-mode', label: 'Reading mode', icon: ICON_BOOK_OPEN }] as const;

export type ToolbarMenuActionId = (typeof TOOLBAR_MENU_ACTIONS)[number]['id'];

/** Every action the toolbar can emit, including menu-only ones. */
export type ToolbarAnyActionId = ToolbarActionId | ToolbarMenuActionId;

/** The smart-AI actions exposed on a translated/selected sentence. */
export type SmartAssistActionId =
  | 'explain-sentence'
  | 'explain-grammar'
  | 'explain-vocabulary'
  | 'simplify'
  | 'summarize'
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
 * framework) so it can live inside the content-script IIFE bundle. Emits a
 * CustomEvent (`avs-toolbar-action`) carrying the action id + selection text;
 * the content entry point wires those to the message bus.
 */
export class SelectionToolbar {
  private element: HTMLElement | null = null;
  private buttons: HTMLButtonElement[] = [];
  private menu: HTMLElement | null = null;
  private moreButton: HTMLButtonElement | null = null;
  private state: ToolbarState | null = null;
  private scrollHandler = (): void => this.reposition();

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;
    toolbar.className = 'avs-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-orientation', 'horizontal');
    toolbar.setAttribute('aria-label', 'Text selection actions');
    toolbar.hidden = true;

    for (const action of TOOLBAR_ACTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'avs-toolbar-btn';
      button.dataset.action = action.id;
      button.setAttribute('aria-label', action.label);
      button.title = action.label;
      // Roving tabindex: only the active button is reachable by Tab.
      button.tabIndex = this.buttons.length === 0 ? 0 : -1;
      button.innerHTML = action.icon;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (action.id === 'more') {
          this.toggleMenu();
          return;
        }
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
      if (action.id === 'more') this.moreButton = button;
    }

    const menu = document.createElement('div');
    menu.id = `${TOOLBAR_ID}-menu`;
    menu.className = 'avs-toolbar-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'More actions');
    menu.hidden = true;
    for (const action of TOOLBAR_MENU_ACTIONS) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'avs-toolbar-menu-item';
      item.dataset.action = action.id;
      item.setAttribute('role', 'menuitem');
      item.setAttribute('aria-label', action.label);
      item.title = action.label;
      item.innerHTML = action.icon;
      const label = document.createElement('span');
      label.textContent = action.label;
      item.append(label);
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.state) {
          document.dispatchEvent(
            new CustomEvent('avs-toolbar-action', {
              detail: { action: action.id, text: this.state.text },
            }),
          );
        }
        this.hideMenu();
      });
      menu.append(item);
    }
    toolbar.append(menu);
    this.menu = menu;

    toolbar.addEventListener('keydown', (event) => this.handleKeydown(event));
    document.body.append(toolbar);
    this.element = toolbar;
    return toolbar;
  }

  /** ARIA toolbar keyboard interaction: arrows move focus, Home/End jump. */
  private handleKeydown(event: KeyboardEvent): void {
    const current = event.target;
    if (!(current instanceof HTMLButtonElement) || !this.buttons.includes(current)) return;

    let next: HTMLButtonElement | undefined;
    const index = this.buttons.indexOf(current);
    if (event.key === 'ArrowRight') {
      next = this.buttons[index + 1] ?? this.buttons[0];
    } else if (event.key === 'ArrowLeft') {
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
    // Reset the roving tabindex to the first action on each opening.
    this.buttons.forEach((button, index) => {
      button.tabIndex = index === 0 ? 0 : -1;
    });
    toolbar.hidden = false;
    this.reposition();
    window.addEventListener('scroll', this.scrollHandler, true);
  }

  hide(): void {
    if (this.element) this.element.hidden = true;
    this.state = null;
    this.hideMenu();
    window.removeEventListener('scroll', this.scrollHandler, true);
  }

  /** Open/close the 'More' menu containing secondary actions (e.g. reading mode). */
  toggleMenu(): void {
    if (this.isMenuOpen) {
      this.hideMenu();
    } else {
      this.menu?.removeAttribute('hidden');
      this.moreButton?.setAttribute('aria-expanded', 'true');
      this.menu?.querySelector<HTMLElement>('.avs-toolbar-menu-item')?.focus();
    }
  }

  /** Hide the 'More' menu without hiding the toolbar. */
  hideMenu(): void {
    this.menu?.setAttribute('hidden', '');
    this.moreButton?.removeAttribute('aria-expanded');
  }

  get isMenuOpen(): boolean {
    return !!this.menu?.isConnected && !this.menu.hidden;
  }

  get isVisible(): boolean {
    return !!this.element?.isConnected && !this.element.hidden;
  }

  destroy(): void {
    this.hide();
    this.menu?.remove();
    this.menu = null;
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

  toggle(state: ToolbarState): void {
    if (this.isVisible && this.state?.text === state.text) {
      this.hide();
      return;
    }
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
