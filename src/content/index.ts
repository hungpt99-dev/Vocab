import { registerMessageHandlers } from '@/shared/messaging/router';
import { SETTINGS_KEY } from '@/storage/settings-repository';
import { sendMessage } from '@/shared/messaging/client';
import type { ExplainKind } from '@/shared/types/ai';
import type { HighlightData } from '@/shared/messaging/contract';
import { HIGHLIGHT_ATTR, HIGHLIGHT_CLASS, highlightRoot, removeHighlights } from './highlighter';
import { HoverCard } from './hover-card';
import { VocabularyMatcher, type HighlightEntry } from './matcher';
import { readSelection } from './selection';
import {
  SMART_ASSIST_ACTIONS,
  SelectionToolbar,
  SmartAssistMenu,
  readToolbarSelection,
  type SmartAssistActionId,
  type ToolbarActionId,
  type ToolbarState,
} from './toolbar';
import { ExplainPanel } from './explain-panel';
import { applyHighlightColor, injectStyles } from './styles';
import { showToast } from './toast';
import { translateCurrentPage } from './translate/translate';

const RESCAN_DELAY_MS = 400;

const hoverCard = new HoverCard();
const toolbar = new SelectionToolbar();
const assistMenu = new SmartAssistMenu();
const explainPanel = new ExplainPanel();
let matcher = new VocabularyMatcher([]);
let entriesById = new Map<string, HighlightEntry>();
let observer: MutationObserver | null = null;
let rescanTimer: ReturnType<typeof setTimeout> | undefined;

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
/** True after a keyboard-driven selection (Shift+arrows etc.), so the toolbar
 * is surfaced for keyboard-only users even though no `mouseup` ever fires. */
let selectionViaKeyboard = false;

function attachSelectionToolbar(): void {
  document.addEventListener('mouseup', () => {
    // Defer: the selection is finalised after the mouseup event completes.
    setTimeout(() => {
      const state = readToolbarSelection();
      if (state) toolbar.show(state);
    }, 0);
  });

  document.addEventListener('selectionchange', () => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      toolbar.hide();
      return;
    }
    if (selectionViaKeyboard && !toolbar.isVisible) {
      const state = readToolbarSelection();
      if (state) toolbar.show(state);
    }
  });

  document.addEventListener('mousedown', (event) => {
    selectionViaKeyboard = false;
    if (event.target instanceof Node && !toolbarElementContains(event.target)) {
      toolbar.hide();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (
      event.shiftKey &&
      (event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'Home' ||
        event.key === 'End')
    ) {
      selectionViaKeyboard = true;
    }
    if (event.key === 'Escape') toolbar.hide();
  });

  document.addEventListener('avs-toolbar-action', ((event: Event) => {
    const detail = (event as CustomEvent<{ action: ToolbarActionId; text: string; state?: ToolbarState }>).detail;
    void handleToolbarAction(detail.action, detail.text, detail.state);
  }) as EventListener);

  document.addEventListener('avs-assist-action', ((event: Event) => {
    const detail = (event as CustomEvent<{ action: SmartAssistActionId; state: ToolbarState }>).detail;
    void handleAssistAction(detail.action, detail.state);
  }) as EventListener);
}

function toolbarElementContains(node: Node): boolean {
  return !!toolbarElement()?.contains(node);
}

function toolbarElement(): HTMLElement | null {
  return document.getElementById('avs-toolbar');
}

/** Route a toolbar action to the existing message bus / handlers. */
async function handleToolbarAction(
  action: ToolbarActionId,
  text: string,
  state?: ToolbarState,
): Promise<void> {
  switch (action) {
    case 'copy': {
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard', 'success');
      } catch {
        showToast('Could not copy', 'error');
      }
      toolbar.hide();
      return;
    }
    case 'more': {
      if (state) assistMenu.toggle(state);
      return;
    }
    case 'translate': {
      toolbar.hide();
      try {
        const result = await translateCurrentPage();
        if (result.translated > 0) {
          showToast(
            `Translated ${result.translated} passage${result.translated === 1 ? '' : 's'}`,
            'success',
          );
        } else if (result.error) {
          showToast(`Translation failed: ${result.error}`, 'error');
        } else {
          showToast('Nothing to translate', 'error');
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Translation failed.', 'error');
      }
      return;
    }
    default:
      // explain / translate / save are wired in later issues (VOC-44..48).
      // For now surface what was requested so the toolbar is demonstrably live.
      showToast(`${action}: ${text.slice(0, 24)}${text.length > 24 ? '…' : ''}`, 'success');
      toolbar.hide();
  }
}

/**
 * Route a smart-assistance action. The five AI analyses go through the message
 * bus to the ExplainService (provider-agnostic); "Save difficult words" asks
 * the background to extract and persist the difficult words in the repository.
 */
async function handleAssistAction(action: SmartAssistActionId, state: ToolbarState): Promise<void> {
  toolbar.hide();
  if (action === 'save-difficult-words') {
    await saveDifficultWords(state);
    return;
  }
  const assistAction = SMART_ASSIST_ACTIONS.find((candidate) => candidate.id === action);
  if (!assistAction?.kind) return;
  await runExplain(assistAction.label, assistAction.kind, state);
}

async function runExplain(label: string, kind: ExplainKind, state: ToolbarState): Promise<void> {
  try {
    const explanation = await sendMessage({
      type: 'explain',
      payload: { word: state.text, context: state.sentence || undefined, kind },
    });
    explainPanel.show(label, state, explanation);
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'The AI request failed.', 'error');
  }
}

async function saveDifficultWords(state: ToolbarState): Promise<void> {
  try {
    const entries = await sendMessage({
      type: 'save-difficult-words',
      payload: {
        word: state.text,
        context: state.sentence || undefined,
        sourceUrl: state.sourceUrl ?? '',
        sourceTitle: state.sourceTitle ?? '',
        sourceLanguage: state.selection?.sourceLanguage ?? '',
      },
    });
    showToast(
      entries.length === 0
        ? 'No difficult words found'
        : `Saved ${entries.length} word${entries.length === 1 ? '' : 's'}`,
      'success',
    );
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'Could not save the words.', 'error');
  }
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

/** Ignore mutations caused by our own highlight, card and toast nodes. */
function isOwnNode(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const element = node as Element;
  return (
    element.classList.contains(HIGHLIGHT_CLASS) ||
    element.classList.contains('avs-card') ||
    element.classList.contains('avs-toast') ||
    element.classList.contains('avs-toolbar') ||
    element.classList.contains('avs-assist-menu') ||
    element.classList.contains('avs-panel')
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
