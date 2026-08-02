import { isPhrase } from '@/shared/lib/text';

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
  private buttons: HTMLButtonElement[] = [];
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
        if (this.state) {
          document.dispatchEvent(
            new CustomEvent('avs-toolbar-action', {
              detail: { action: action.id, text: this.state.text },
            }),
          );
        }
      });
      this.buttons.push(button);
      toolbar.append(button);
    }

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
