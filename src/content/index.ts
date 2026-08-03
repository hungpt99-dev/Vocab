import { registerMessageHandlers } from '@/shared/messaging/router';
import { SETTINGS_KEY } from '@/storage/settings-repository';
import { sendMessage } from '@/shared/messaging/client';
import type { HighlightData } from '@/shared/messaging/contract';
import { HIGHLIGHT_ATTR, HIGHLIGHT_CLASS, highlightRoot, removeHighlights } from './highlighter';
import { HoverCard } from './hover-card';
import { VocabularyMatcher, type HighlightEntry } from './matcher';
import { readSelection } from './selection';
import { SelectionToolbar, readToolbarSelection, type ToolbarActionId } from './toolbar';
import { handleToolbarAction, type ToolbarActionDeps } from './toolbar-actions';
import { SelectionPopover, type PopoverAnchor } from './selection-popover';
import { MoreMenu } from './more-menu';
import { applyHighlightColor, injectStyles } from './styles';
import { showToast } from './toast';

const RESCAN_DELAY_MS = 400;

const hoverCard = new HoverCard();
const toolbar = new SelectionToolbar();
const popover = new SelectionPopover();
const moreMenu = new MoreMenu();
let matcher = new VocabularyMatcher([]);
let entriesById = new Map<string, HighlightEntry>();
let observer: MutationObserver | null = null;
let rescanTimer: ReturnType<typeof setTimeout> | undefined;

const toolbarActionDeps: ToolbarActionDeps = {
  getAnchor: () => actionAnchor(),
  getMoreButton: () =>
    toolbarElement()?.querySelector<HTMLButtonElement>('[data-action="more"]') ?? null,
  popover,
  menu: moreMenu,
  hideToolbar: () => toolbar.hide(),
};

registerMessageHandlers({
  'get-selection': () => readSelection(),
  'vocabulary-changed': () => void refresh(),
  'settings-changed': () => void refresh(),
  'show-toast': (message) => showToast(message.payload.message, message.payload.variant),
});

void bootstrap();

async function bootstrap(): Promise<void> {
  injectStyles();
  attachHoverListeners();
  attachSelectionToolbar();
  watchSettings();
  await refresh();
}

/**
 * Show the floating selection toolbar on a real (non-collapsed) selection and
 * hide it on outside click, Escape, or when the selection is cleared. Toolbar
 * actions are forwarded to the message bus via `handleToolbarAction`.
 */
function attachSelectionToolbar(): void {
  document.addEventListener('mouseup', () => {
    // Defer: the selection is finalised after the mouseup event completes.
    setTimeout(() => {
      if (popover.isVisible || moreMenu.isVisible) return;
      const state = readToolbarSelection();
      if (state) toolbar.show(state);
    }, 0);
  });

  document.addEventListener('selectionchange', () => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      toolbar.hide();
    }
  });

  document.addEventListener('mousedown', (event) => {
    if (event.target instanceof Node && !toolbarElementContains(event.target)) {
      toolbar.hide();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') toolbar.hide();
  });

  document.addEventListener('avs-toolbar-action', ((event: Event) => {
    const detail = (event as CustomEvent<{ action: ToolbarActionId; text: string }>).detail;
    void handleToolbarAction(detail.action, detail.text, toolbarActionDeps);
  }) as EventListener);
}

function toolbarElementContains(node: Node): boolean {
  return !!toolbarElement()?.contains(node);
}

function toolbarElement(): HTMLElement | null {
  return document.getElementById('avs-toolbar');
}

/**
 * The popover is anchored to the live selection, falling back to the toolbar's
 * last position and then a neutral viewport spot when neither is measurable.
 */
function actionAnchor(): PopoverAnchor {
  const selection = readToolbarSelection();
  if (selection) return selection.rect;

  const rect = toolbarElement()?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width };
  }
  return { top: 120, bottom: 140, left: window.innerWidth / 2, width: 0 };
}

/**
 * Observe settings directly rather than relying on a relay from the service
 * worker, which may be asleep when the user changes a preference.
 */
function watchSettings(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SETTINGS_KEY]) void refresh();
  });
}

/** Pull the latest vocabulary + settings and re-apply highlighting. */
async function refresh(): Promise<void> {
  let data: HighlightData;
  try {
    data = await sendMessage({ type: 'get-highlight-data' });
  } catch {
    // The service worker is asleep or the extension was reloaded.
    return;
  }

  applyHighlightColor(data.color);
  entriesById = new Map(data.entries.map((entry) => [entry.id, entry]));
  matcher = new VocabularyMatcher(data.entries);

  removeHighlights();
  if (!data.enabled || matcher.size === 0) {
    stopObserving();
    return;
  }

  scan(document.body);
  startObserving();
}

function scan(root: Node | null): void {
  if (!root) return;
  const run = (): void => void highlightRoot(root, matcher);
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 1000 });
  } else {
    run();
  }
}

function startObserving(): void {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    const touchedContent = mutations.some((mutation) =>
      [...mutation.addedNodes].some((node) => !isOwnNode(node)),
    );
    if (!touchedContent) return;

    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(() => scan(document.body), RESCAN_DELAY_MS);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserving(): void {
  observer?.disconnect();
  observer = null;
}

/** Ignore mutations caused by our own highlight, card, toast, popover and menu nodes. */
function isOwnNode(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const element = node as Element;
  return (
    element.classList.contains(HIGHLIGHT_CLASS) ||
    element.classList.contains('avs-card') ||
    element.classList.contains('avs-toast') ||
    element.classList.contains('avs-toolbar') ||
    element.classList.contains('avs-popover') ||
    element.classList.contains('avs-menu')
  );
}

function attachHoverListeners(): void {
  const openFor = (target: EventTarget | null): void => {
    const mark = target instanceof Element ? target.closest(`.${HIGHLIGHT_CLASS}`) : null;
    if (!(mark instanceof HTMLElement)) return;
    const entry = entriesById.get(mark.getAttribute(HIGHLIGHT_ATTR) ?? '');
    if (entry) hoverCard.show(mark, entry);
  };
  const closeFor = (target: EventTarget | null): void => {
    const mark = target instanceof Element ? target.closest(`.${HIGHLIGHT_CLASS}`) : null;
    hoverCard.hide(mark instanceof HTMLElement ? mark : undefined);
  };

  document.addEventListener('mouseover', (event) => openFor(event.target));
  document.addEventListener('mouseout', (event) => closeFor(event.target));
  document.addEventListener('focusin', (event) => openFor(event.target));
  document.addEventListener('focusout', (event) => closeFor(event.target));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hoverCard.hide();
  });
}
