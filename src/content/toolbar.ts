import { isPhrase } from '@/shared/lib/text';
import type { ExplainKind } from '@/shared/types/ai';
import type { SelectionPayload } from '@/shared/messaging/contract';
import { readSelection } from './selection';
import { computePosition } from './hover-card';
import {
  ICON_BOOK,
  ICON_BOOKMARK,
  ICON_FILE,
  ICON_LANGUAGES,
  ICON_MESSAGE,
  ICON_MINIMIZE,
  ICON_SPARKLES,
  ICON_WAND,
} from './icons';

const MENU_ID = 'avs-assist-menu';

/** The unit of the current selection. Drives which explain prompt the downstream popover uses. */
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

/** Every action the toolbar can emit. */
export type ToolbarAnyActionId = 'generate' | 'explain' | 'simplify' | 'save' | 'copy' | 'more';

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

/**
 * Dropdown listing the smart-AI actions on a selection. Opens anchored to the
 * selection card; emits an `avs-assist-action` CustomEvent carrying the action
 * id and the full toolbar state, which the content entry point routes to the
 * ExplainService (or the repository for "Save difficult words").
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

  /** Anchor the menu to the selection card, flipping above when there is no room below. */
  private position(menu: HTMLElement): void {
    const anchorEl = document.getElementById('avs-selection-card');
    const anchor = anchorEl?.getBoundingClientRect() ?? this.state?.rect;
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
