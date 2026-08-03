import { isPhrase } from '@/shared/lib/text';
import type { ExplainKind } from '@/shared/types/ai';
import type { SelectionPayload } from '@/shared/messaging/contract';
import { readSelection } from './selection';
import { computePosition } from './hover-card';
import { computeMenuPosition } from './more-menu';

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

/* Lucide icon paths (24x24, stroke-based) inlined as SVG so the toolbar needs
 * no runtime icon dependency inside the third-party page. */
const wrap = (paths: string): string =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICON_SPARKLES = wrap(
  '<path d="M9.94 14.34A2 2 0 0 0 8.66 13.06L3 11l5.66-2.06A2 2 0 0 0 9.94 9.66L12 4l2.06 5.66a2 2 0 0 0 1.28 1.28L21 11l-5.66 2.06a2 2 0 0 0-1.28 1.28L12 20l-2.06-5.66z"/>',
);
const ICON_LANGUAGES = wrap(
  '<path d="m5 8 3-3 3 3"/><path d="M12 19h4l3-3 3 3"/><path d="M5.5 8.5h5"/><path d="M14.5 15.5h5"/>' +
    '<path d="M3 11c2 1 4 1.5 6 1.5s4-.5 6-1.5"/>',
);
const ICON_BOOKMARK = wrap('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>');
const ICON_COPY = wrap(
  '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
);
const ICON_MORE = wrap('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>');
const ICON_BOOK_OPEN = wrap(
  '<path d="M12 7c-2.5-1.5-6-1.5-8 0v11c2-1.5 5.5-1.5 8 0 2.5-1.5 6-1.5 8 0V7c-2-1.5-5.5-1.5-8 0z"/>' +
    '<path d="M12 7v11"/>',
);
const ICON_MESSAGE = wrap(
  '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M13 8H7"/><path d="M17 12H7"/>',
);
const ICON_BOOK = wrap(
  '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
);
const ICON_MINIMIZE = wrap(
  '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
);
const ICON_FILE = wrap(
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
);

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
      if (action.id === 'more') {
        this.moreButton = button;
        button.setAttribute('aria-haspopup', 'menu');
      }
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
      this.positionMenu();
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

  /** Anchor the 'More' menu below the trigger, right-aligned to it. */
  private positionMenu(): void {
    if (!this.menu || !this.moreButton) return;
    const { width, height } = this.menu.getBoundingClientRect();
    const { top, left } = computeMenuPosition(
      this.moreButton.getBoundingClientRect(),
      { width, height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    this.menu.style.top = `${top}px`;
    this.menu.style.left = `${left}px`;
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
