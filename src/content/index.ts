import { registerMessageHandlers } from '@/shared/messaging/router';
import { SETTINGS_KEY } from '@/storage/settings-repository';
import { sendMessage } from '@/shared/messaging/client';
import type { HighlightData, SelectionPayload } from '@/shared/messaging/contract';
import { HIGHLIGHT_ATTR, HIGHLIGHT_CLASS, highlightRoot, removeHighlights } from './highlighter';
import { CARD_ACTION_EVENT, HoverCard, type CardActionDetail } from './hover-card';
import { VocabularyMatcher, type HighlightEntry } from './matcher';
import { readSelection } from './selection';
import {
  SelectionToolbar,
  readToolbarSelection,
  type ToolbarActionId,
  type ToolbarState,
} from './toolbar';
import { applyHighlightColor, injectStyles } from './styles';
import { showToast } from './toast';

const RESCAN_DELAY_MS = 400;

const hoverCard = new HoverCard();
const toolbar = new SelectionToolbar();
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
  attachCardActions();
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
    const detail = (event as CustomEvent<{ action: ToolbarActionId; text: string; state?: ToolbarState }>).detail;
    void handleToolbarAction(detail.action, detail.text, detail.state);
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
    case 'save': {
      await saveFromReading(text, state?.selection);
      return;
    }
    default:
      // explain / translate are wired in later issues (VOC-44..48).
      // For now surface what was requested so the toolbar is demonstrably live.
      showToast(`${action}: ${text.slice(0, 24)}${text.length > 24 ? '…' : ''}`, 'success');
      toolbar.hide();
  }
}

/**
 * Save the word selected on the page straight into the vocabulary. Uses the
 * selection metadata captured when the toolbar opened, because clicking the
 * toolbar clears the page selection.
 */
async function saveFromReading(
  text: string,
  selection?: SelectionPayload,
): Promise<void> {
  const word = text.trim();
  if (!word) {
    showToast('Select a word first.', 'error');
    toolbar.hide();
    return;
  }
  try {
    const entry = await sendMessage({
      type: 'save-entry',
      payload: selection
        ? { word, sentence: selection.sentence, sourceUrl: selection.sourceUrl, sourceTitle: selection.sourceTitle }
        : { word },
    });
    showToast(`Saved "${entry.word}"`, 'success');
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'Could not save the word.', 'error');
  }
  toolbar.hide();
}

/**
 * Route a hover-card shortcut. The AI request goes through the message bus to
 * the provider-agnostic ExplainService in the background worker; the content
 * script never touches a provider directly.
 */
async function handleCardExplain(entry: HighlightEntry): Promise<void> {
  hoverCard.setExplaining(true);
  try {
    const explanation = await sendMessage({ type: 'explain', payload: { word: entry.word } });
    hoverCard.update({
      ...entry,
      meaning: explanation.meaning,
      pronunciation: explanation.pronunciation,
    });
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'The AI request failed.', 'error');
  } finally {
    hoverCard.setExplaining(false);
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
    element.classList.contains('avs-toolbar')
  );
}

function attachHoverListeners(): void {
  const openFor = (event: Event): void => {
    const target = event.target;
    // Hovering the card itself (its AI shortcut) must not close or swap it.
    if (target instanceof Element && hoverCard.contains(target)) return;
    const mark = target instanceof Element ? target.closest(`.${HIGHLIGHT_CLASS}`) : null;
    if (!(mark instanceof HTMLElement)) return;
    const entry = entriesById.get(mark.getAttribute(HIGHLIGHT_ATTR) ?? '');
    if (entry) hoverCard.show(mark, entry);
  };
  const closeFor = (event: Event): void => {
    // Moving onto the card keeps it open so its AI shortcut can be clicked.
    const related = (event as MouseEvent).relatedTarget;
    if (related instanceof Node && hoverCard.contains(related)) return;
    const mark = event.target instanceof Element ? event.target.closest(`.${HIGHLIGHT_CLASS}`) : null;
    hoverCard.hide(mark instanceof HTMLElement ? mark : undefined);
  };

  document.addEventListener('mouseover', openFor);
  document.addEventListener('mouseout', closeFor);
  document.addEventListener('focusin', openFor);
  document.addEventListener('focusout', closeFor);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hoverCard.hide();
  });
}

/** Wire hover-card shortcuts (currently the AI-explain action). */
function attachCardActions(): void {
  document.addEventListener(CARD_ACTION_EVENT, ((event: Event) => {
    const detail = (event as CustomEvent<CardActionDetail>).detail;
    if (detail.action === 'explain') void handleCardExplain(detail.entry);
  }) as EventListener);
}
