import { isPhrase } from '@/shared/lib/text';
import { ICON_BOOKMARK, ICON_COPY, ICON_LANGUAGES, ICON_MORE, ICON_SPARKLES } from './icons';

const TOOLBAR_ID = 'avs-toolbar';
const OFFSET = 8;

/**
 * The unit of the current selection. Drives which explain prompt the
 * downstream popover uses (word vs phrase vs sentence vs paragraph).
 */
export type SelectionUnit = 'word' | 'phrase' | 'sentence' | 'paragraph';

export interface ToolbarState {
  /** Non-collapsed selected text, whitespace-collapsed. */
  text: string;
  /** Detected selection unit. */
  unit: SelectionUnit;
  /** Bounding rect of the selection range, viewport-relative. */
  rect: { top: number; bottom: number; left: number; width: number };
}

/* Icons (see ./icons) provide the toolbar buttons with lucide glyphs without
 * a runtime icon dependency inside the third-party page. */

const TOOLBAR_ACTIONS = [
  { id: 'explain', label: 'Explain with AI', icon: ICON_SPARKLES },
  { id: 'translate', label: 'Translate', icon: ICON_LANGUAGES },
  { id: 'save', label: 'Save to Vocabulary', icon: ICON_BOOKMARK },
  { id: 'copy', label: 'Copy', icon: ICON_COPY },
  { id: 'more', label: 'More', icon: ICON_MORE },
] as const;

export type ToolbarActionId = (typeof TOOLBAR_ACTIONS)[number]['id'];

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

  return {
    text,
    unit: classifySelection(text),
    rect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
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
  private state: ToolbarState | null = null;
  private scrollHandler = (): void => this.reposition();

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;
    toolbar.className = 'avs-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Text selection actions');
    toolbar.hidden = true;

    for (const action of TOOLBAR_ACTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'avs-toolbar-btn';
      button.dataset.action = action.id;
      button.setAttribute('aria-label', action.label);
      button.title = action.label;
      button.innerHTML = action.icon;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.state) {
          document.dispatchEvent(
            new CustomEvent('avs-toolbar-action', {
              detail: { action: action.id, text: this.state.text },
            }),
          );
        }
      });
      toolbar.append(button);
    }

    document.body.append(toolbar);
    this.element = toolbar;
    return toolbar;
  }

  show(state: ToolbarState): void {
    this.state = state;
    const toolbar = this.ensureElement();
    toolbar.hidden = false;
    this.reposition();
    window.addEventListener('scroll', this.scrollHandler, true);
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
