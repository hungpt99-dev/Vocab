import { registerMessageHandlers } from '@/shared/messaging/router';
import { SETTINGS_KEY, settingsRepository } from '@/storage/settings-repository';
import { sendMessage } from '@/shared/messaging/client';
import type { ExplainKind } from '@/shared/types/ai';
import type { HighlightData } from '@/shared/messaging/contract';
import { HIGHLIGHT_ATTR, HIGHLIGHT_CLASS, highlightRoot, removeHighlights } from './highlighter';
import { HoverCard } from './hover-card';
import { VocabularyMatcher, type HighlightEntry } from './matcher';
import { readSelection } from './selection';
import {
  readToolbarSelection,
  type ToolbarAnyActionId,
  type ToolbarState,
} from './toolbar';
import { SelectionCard } from './selection-card';
import {
  cardOwnsInteraction,
  isInsideCard,
  shouldHideOnSelectionChange,
} from './selection-dismiss';
import { applyHighlightColor, injectStyles } from './styles';
import { showToast } from './toast';
import { InlineReader } from './reading/inline-reader';
import { extractArticle } from './reading/extract';
// The inline reader imports from './domain' directly to keep the module graph
// acyclic; this import+re-export keeps `matchesDomain` available at the entry
// (and in the entry's tests) without the old circular dependency.
import { matchesDomain } from './domain';
export { matchesDomain };

const RESCAN_DELAY_MS = 400;

const hoverCard = new HoverCard();
const toolbar = new SelectionCard();
const reader = new InlineReader();

/** Latest settings snapshot, kept in sync by refresh(); used for keyless gating. */
let currentSettings: import('@/shared/types/settings').Settings | null = null;

/** Whether an AI provider is usable right now (mirrors useAiAvailable in the popup). */
function isAiAvailable(): boolean {
  const settings = currentSettings;
  if (!settings) return false;
  const active = settings.providers.find((p) => p.id === settings.activeProviderId);
  if (!active) return false;
  const needsKey = !['ollama', 'lmstudio'].includes(active.type);
  return needsKey ? (active.apiKey ?? '').trim().length > 0 : true;
}
let matcher = new VocabularyMatcher([]);
let entriesById = new Map<string, HighlightEntry>();
let observer: MutationObserver | null = null;
let rescanTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * Per-tab bilingual opt-out. The user can turn bilingual off on ONE page via the
 * in-page bar; that must not affect other tabs. The global `bilingualMode`
 * setting is the *default* (set from the popup); this flag is the local override
 * for the current tab only, and resets on reload.
 */
let localBilingualOff = false;

registerMessageHandlers({
  'get-selection': () => readSelection(),
  'vocabulary-changed': () => void refresh(),
  'settings-changed': () => void refresh(),
  'show-toast': (message) => showToast(message.payload.message, message.payload.variant),
  'toggle-bilingual-reading': () => void reader.toggle(),
  'extract-page-text': () => {
    // Reuse the existing article extractor: skips nav/footer/script/ads and
    // prefers <article>/<main>. Join blocks with blank lines for the AI.
    const blocks = extractArticle();
    return blocks.map((block) => block.text).join('\n\n');
  },
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
/** True while the pointer is held down inside the card (VOC-123). */
let pointerInsideCard = false;

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
    const selectionEmpty = !selection || selection.isCollapsed || !selection.toString().trim();
    if (selectionEmpty) {
      // Interacting with the card collapses the page selection; that must not
      // close the card out from under the user (VOC-123).
      const interactingWithCard = cardOwnsInteraction(
        toolbarElement(),
        document.activeElement,
        pointerInsideCard,
      );
      if (shouldHideOnSelectionChange({ selectionEmpty, interactingWithCard })) toolbar.hide();
      return;
    }
    if (selectionViaKeyboard && !toolbar.isVisible) {
      const state = readToolbarSelection();
      if (state) toolbar.show(state);
    }
  });

  document.addEventListener('mousedown', (event) => {
    selectionViaKeyboard = false;
    const inside = event.target instanceof Node && toolbarElementContains(event.target);
    pointerInsideCard = inside;
    if (!inside) toolbar.hide();
  });

  // Release the pointer guard only after the click has been fully dispatched,
  // so the selectionchange it triggers still sees the interaction as ours.
  document.addEventListener('mouseup', (event) => {
    if (event.target instanceof Node && toolbarElementContains(event.target)) {
      setTimeout(() => {
        pointerInsideCard = false;
      }, 0);
      return;
    }
    pointerInsideCard = false;
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
    const detail = (event as CustomEvent<{ action: ToolbarAnyActionId; text: string; state?: ToolbarState }>).detail;
    void handleToolbarAction(detail.action, detail.text, detail.state);
  }) as EventListener);
}

function toolbarElementContains(node: Node): boolean {
  return isInsideCard(node, toolbarElement());
}

function toolbarElement(): HTMLElement | null {
  return document.getElementById('avs-selection-card');
}

/** Route a toolbar action to the existing message bus / handlers. */
async function handleToolbarAction(
  action: ToolbarAnyActionId,
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
      toolbar.hide();
      if (state) await saveSelectionState(state);
      else showToast('No selection to save.', 'error');
      return;
    }
    // One AI button generates the full enrichment (meaning, translation, examples,
    // synonyms, related words) inline in the card. The reader's highlighted-word
    // click still dispatches 'explain' for the same full card, and 'simplify'
    // requests the simplified variant. See VOC-119.
    case 'generate':
    case 'explain': {
      toolbar.hide();
      if (state) showInlineExplain(state, 'word');
      return;
    }
    // X-Ray Reading (VOC-121): reveal the simple idea hidden inside the
    // selected text. The card stays open so the result renders inline.
    case 'xray': {
      if (state) showInlineExplain(state, 'xray');
      return;
    }
    case 'simplify': {
      toolbar.hide();
      if (state) showInlineExplain(state, 'simplify');
      return;
    }
    default:
      showToast(`${action}: ${text.slice(0, 24)}${text.length > 24 ? '…' : ''}`, 'success');
      toolbar.hide();
  }
}

/** Save using the selection captured when the toolbar opened (not the live,
 * possibly-collapsed selection), so the button never silently no-ops. */
async function saveSelectionState(state: ToolbarState): Promise<void> {
  const payload = state.selection;
  if (!payload || !payload.word.trim()) {
    showToast('No selection to save.', 'error');
    return;
  }
  try {
    const entry = await sendMessage({ type: 'save-selection', payload });
    if (entry) showToast(`Saved "${entry.word}"`, 'success');
    else showToast('No selection to save.', 'error');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not save that word.', 'error');
  }
}

/** Open the inline explain inside the floating toolbar for the current selection + analysis kind. */
function showInlineExplain(state: ToolbarState, kind: ExplainKind): void {
  if (!isAiAvailable()) {
    showToast('AI actions need an API key in settings', 'error');
    return;
  }
  void toolbar.showExplain(state, kind);
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
  let data: HighlightData | undefined;
  try {
    data = await sendMessage({ type: 'get-highlight-data' });
  } catch {
    // The service worker is asleep or the extension was reloaded.
    return;
  }
  // No data (e.g. the service worker vanished between dispatch and resolution,
  // or a test harness without a mocked worker): skip this refresh rather than
  // crash the page.
  if (!data) return;

  // Keep a settings snapshot for AI-key gating in the toolbar/assist menu.
  try {
    currentSettings = await settingsRepository.get();
  } catch {
    // Non-fatal: gating will assume no AI key until the next refresh.
  }

  // Bilingual (inline) reading is independent of word highlighting: sync it first
  // so the headbar + inline translations appear even when no words are saved.
  syncBilingual(data.bilingualMode, data.bilingualDomains);

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

function syncBilingual(enabled: boolean, domains: readonly string[]): void {
  // Auto-enable for configured domains even when the global switch is off.
  const active = enabled || matchesDomain(location.hostname, domains);
  if (!active) {
    // Bilingual is off for this page: any local opt-out is moot.
    localBilingualOff = false;
    document.body.classList.remove('avs-bilingual-on');
    if (reader.isOpen) reader.close();
    return;
  }
  // Bilingual is on, but this tab may have opted out locally.
  if (localBilingualOff) {
    document.body.classList.remove('avs-bilingual-on');
    if (reader.isOpen) reader.close();
    return;
  }
  document.body.classList.add('avs-bilingual-on');
  // The reader renders its own inline control (show/hide, layout, close), so no
  // separate floating bar is needed — that kept colliding with the popup.
  void reader.open();
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
    element.classList.contains('avs-panel') ||
    element.classList.contains('avs-inline-translation') ||
    element.classList.contains('avs-inline-control') ||
    element.classList.contains('avs-gloss-word') ||
    element.classList.contains('avs-word-gloss')
  );
}

function attachHoverListeners(): void {
  const openFor = async (target: EventTarget | null): Promise<void> => {
    const mark = target instanceof Element ? target.closest(`.${HIGHLIGHT_CLASS}`) : null;
    if (!(mark instanceof HTMLElement)) return;
    const entry = entriesById.get(mark.getAttribute(HIGHLIGHT_ATTR) ?? '');
    if (!entry) return;
    const settings = await settingsRepository.get();
    hoverCard.show(mark, entry, {
      showOriginal: true,
      showTranslation: settings.bilingualMode,
    });
  };
  const closeFor = (): void => {
    // Defer closing so the user can move the cursor across the gap onto the card.
    hoverCard.scheduleHide();
  };

  document.addEventListener('mouseover', (event) => openFor(event.target));
  document.addEventListener('mouseout', () => closeFor());
  document.addEventListener('focusin', (event) => openFor(event.target));
  document.addEventListener('focusout', () => closeFor());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hoverCard.hide();
  });
}
