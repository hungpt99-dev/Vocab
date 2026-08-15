import { registerMessageHandlers } from '@/shared/messaging/router';
import { SETTINGS_KEY, settingsRepository } from '@/storage/settings-repository';
import { sendMessage } from '@/shared/messaging/client';
import type { ExplainKind } from '@/shared/types/ai';
import type { HighlightData } from '@/shared/messaging/contract';
import { isReadingActiveOnHost } from '@/shared/types/settings';
import { HIGHLIGHT_ATTR, HIGHLIGHT_CLASS, highlightRoot, removeHighlights } from './highlighter';
import {
  highlightRadarRoot,
  removeRadarHighlights,
  RADAR_HIGHLIGHT_CLASS,
  RADAR_HIGHLIGHT_ATTR,
  type RadarMatchEntry,
} from './highlighter';
import { HoverCard } from './hover-card';
import { RadarCard } from './radar-card';
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
import { installSpaNavHandler } from './spa';
import { isContextInvalidationError } from './context-invalidation';
import { matchesDomain } from './domain';
export { matchesDomain };

const RESCAN_DELAY_MS = 400;

const hoverCard = new HoverCard();
const radarCard = new RadarCard();
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
let radarByKey = new Map<string, HighlightData['radar'][number]>();
let observer: MutationObserver | null = null;
let rescanTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * Per-tab bilingual opt-out. The user can turn bilingual off on ONE page via the
 * in-page bar; that must not affect other tabs. The global `bilingualMode`
 * setting is the *default* (set from the popup); this flag is the local override
 * for the current tab only, and resets on reload.
 */
let localBilingualOff = false;

/**
 * Signature of the article's current block set, used to decide whether a DOM
 * mutation actually changed the translatable content. Re-highlighting vocabulary
 * words (e.g. after saving one) mutates the page but leaves the block set the
 * same, so we must NOT re-translate on those — only on a genuine article change.
 */
let lastArticleSig = '';

registerMessageHandlers({
  'get-selection': () => readSelection(),
  // Word saves change the vocabulary, not the Bilingual scope. Refresh only the
  // highlights/Radar — NOT the Bilingual reader (which would re-translate the
  // whole page, looking like an auto-reload on every saved word). Reading-mode
  // / allowed-list changes come through `settings-changed` and run the full
  // refresh() that re-evaluates Bilingual scope.
  'vocabulary-changed': () => void refreshVocabulary(),
  'settings-changed': () => void refresh(),
  'show-toast': (message) => showToast(message.payload.message, message.payload.variant),
  'toggle-bilingual-reading': () => void reader.toggle(),
  'bilingual:refresh': (message) => void reader.refresh(message.force),
  'bilingual:reconcile': () => void reconcileBilingual(),
});

void bootstrap();

async function bootstrap(): Promise<void> {
  // Swallow "Extension context invalidated" rejections. These happen when the
  // extension is reloaded/updated while a tab stays open (or the MV3 service
  // worker is torn down): in-flight or fire-and-forget chrome.* calls (e.g. the
  // Radar auto-scan triggered by the MutationObserver, or reader.open() during a
  // tab switch) reject and, being unawaited, would surface as an uncaught error
  // in content.js. They are harmless once the context is gone, so we ignore them
  // instead of letting them bubble to the console.
  window.addEventListener('unhandledrejection', (event) => {
    // Harmless once the extension context is gone (reload/update, worker killed):
    // in-flight or fire-and-forget chrome.* calls reject and, being unawaited,
    // would otherwise surface as an uncaught error in content.js.
    if (isContextInvalidationError(event.reason)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  injectStyles();
  attachHoverListeners();
  attachSelectionToolbar();
  watchSettings();
  // Re-translate after an in-tab (SPA) navigation: client-side routers swap the
  // page without a full reload, so nothing else re-triggers Bilingual.
  installSpaNavHandler(scheduleBilingualRefresh);
  await refresh();
  // Record the initial article signature so the highlight MutationObserver's
  // re-translate guard knows the starting content (it would otherwise treat the
  // first post-load mutation as a brand-new article and re-translate on load).
  lastArticleSig = extractArticle().map((b) => b.id).join('|');
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
    // requests the simplified variant. See VOC-119. Keep the card open (like
    // xray) so the inline "Asking the AI…" status renders in place instead of
    // flickering through a hide/re-show — the button also shows a loading state.
    case 'generate':
    case 'explain': {
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
    if (areaName === 'local' && changes[SETTINGS_KEY]) {
      void refresh();
    }
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

  // Bilingual (inline) reading is driven by the shared reading mode: 'everywhere'
  // always, 'allowed' only on the shared allowedDomains, 'off' never. Sync it
  // first so the headbar + inline translations appear even when no words are saved.
  syncBilingual(data.readingMode, data.allowedDomains);

  refreshHighlights(data);
}

/**
 * Re-apply word highlighting + Radar auto-scan from the latest vocabulary,
 * WITHOUT touching the Bilingual reader. Word saves broadcast `vocabulary-changed`,
 * which must refresh highlights/radar but must NOT re-translate the page — the
 * Bilingual reader keeps its own session cache and re-syncing here would make the
 * whole page flash + re-translate on every saved word (looks like an auto-reload).
 * A reading-mode / allowed-list change arrives via `settings-changed`, which calls
 * the full `refresh()` above and legitimately re-evaluates Bilingual scope.
 */
function refreshHighlights(data: HighlightData): void {
  applyHighlightColor(data.color);
  entriesById = new Map(data.entries.map((entry) => [entry.id, entry]));
  matcher = new VocabularyMatcher(data.entries);

  removeHighlights();
  removeRadarHighlights();
  if (!data.enabled || matcher.size === 0) {
    stopObserving();
    return;
  }

  scan(document.body);
  startObserving();

  // Vocabulary Radar: highlight generated candidates from the user's saved
  // vocabulary. Driven purely by the persisted Radar list — no AI page scan.
  applyRadarHighlights(data.radar);
}

/**
 * Lightweight refresh triggered by a vocabulary change (word saved/edited/deleted).
 * Re-applies only the word highlights + Radar — deliberately does NOT re-sync the
 * Bilingual reader, whose translation is already in the DOM and session cache;
 * re-syncing would re-translate the whole page (looks like an auto-reload on every
 * saved word). Reading-mode / allowed-list changes go through refresh() instead.
 */
async function refreshVocabulary(): Promise<void> {
  let data: HighlightData | undefined;
  try {
    data = await sendMessage({ type: 'get-highlight-data' });
  } catch {
    return;
  }
  if (!data) return;
  refreshHighlights(data);
}

/** Highlight generated Radar candidates on the page (no AI, no page scan). */
function applyRadarHighlights(radar: HighlightData['radar']): void {
  removeRadarHighlights();
  radarByKey = new Map(radar.map((r) => [r.wordKey, r]));
  if (radar.length === 0) return;
  const entries: RadarMatchEntry[] = radar.map((r) => ({
    key: r.wordKey,
    text: r.word,
    tier: 'high',
  }));
  highlightRadarRoot(document.body, entries);
}

/** Debounce before re-translating after an in-tab (SPA) navigation. */
const SPA_REFRESH_MS = 400;
const SPA_REFRESH_POLL_MS = 250;
const SPA_REFRESH_MAX_ATTEMPTS = 8;
let bilingualRefreshTimer: number | undefined;

/**
 * Re-translate the current page after an SPA route change. The reader keeps its
 * translated DOM across tab switches (hide/show), but a same-tab SPA navigation
 * swaps in genuinely new content that was never translated, so we re-extract and
 * re-translate it. Guarded to the visible, open, bilingual-active tab so we don't
 * burn AI calls on backgrounded or hidden readers.
 */
function scheduleBilingualRefresh(): void {
  if (document.visibilityState !== 'visible') return;
  clearTimeout(bilingualRefreshTimer);
  // After an SPA navigation we must re-derive whether translation should be on
  // for the NEW route (the previous view may not have had it active), and open
  // it if so. Real client-side routers also mount the new route asynchronously
  // (data fetch / transition), so poll briefly for the article before acting.
  let attempts = 0;
  const attempt = async () => {
    const count = extractArticle().length;
    if (count === 0) {
      if (attempts++ < SPA_REFRESH_MAX_ATTEMPTS) {
        bilingualRefreshTimer = window.setTimeout(attempt, SPA_REFRESH_POLL_MS);
      }
      return;
    }
    // Record the signature of what we're about to translate so the MutationObserver
    // guard won't re-fire on subsequent same-content mutations (only a genuine
    // article change will clear this and trigger another re-translate).
    lastArticleSig = extractArticle().map((b) => b.id).join('|');
    try {
      const settings = await settingsRepository.get();
      if (reader.isOpen) {
        // Already translating this tab: re-translate the new content in place.
        await reader.refresh();
        return;
      }
      // Not yet open: decide from current settings + this host, then open if it
      // should be on. This is what makes translation auto-turn-on after SPA nav.
      syncBilingual(settings.readingMode, settings.allowedDomains);
    } catch {
      // Settings read failed; leave the page as-is rather than throwing.
    }
  };
  bilingualRefreshTimer = window.setTimeout(attempt, SPA_REFRESH_MS);
}

/**
 * Tracks whether bilingual is effectively on for THIS tab. The decision of
 * whether to actually translate is delegated to the service worker, which is
 * the only place that knows which tab is currently active.
 */
let bilingualActiveHere = false;

/**
 * Open or close the inline reader based on whether THIS tab is the active tab.
 *
 * Content scripts run in EVERY open tab, so a global bilingual setting would
 * otherwise turn translation on in all of them at once (the bug where enabling
 * bilingual hit every open tab). We ask the service worker "am I the active
 * tab?" — it answers via chrome.tabs.get(sender tab id) — and only the single
 * active tab ever translates. The service worker also broadcasts
 * `bilingual:reconcile` to every tab on tab-switch, so exactly one tab
 * translates at a time and the previous one closes.
 *
 * IMPORTANT: this is only for the *cross-tab* single-active enforcement (tab
 * switches). It must NOT be the gate for *this* tab opening when its own scope
 * just became active (e.g. the user clicked "Allow site" in the popup). In that
 * path `syncBilingual` already owns the scope decision synchronously; routing it
 * through `am-i-active-tab` races with the popup focus and can leave the page
 * untranslated until a reload. So `syncBilingual` opens directly when in scope.
 */
async function reconcileBilingual(): Promise<void> {
  if (!bilingualActiveHere || localBilingualOff) {
    document.body.classList.remove('avs-bilingual-on');
    if (reader.isOpen) reader.close();
    return;
  }
  document.body.classList.add('avs-bilingual-on');
  let isActive = false;
  let reachable = true;
  try {
    isActive = await sendMessage({ type: 'am-i-active-tab' });
  } catch {
    // Worker unreachable: previously we stayed closed, leaving the user with
    // "nothing happens" and no way to tell why. The user explicitly enabled
    // bilingual here, so fall back to opening in the current tab rather than
    // silently doing nothing.
    reachable = false;
    isActive = true;
    console.warn('[bilingual] am-i-active-tab worker unreachable; opening in current tab');
  }
  if (!reachable && !isActive) {
    if (reader.isOpen) reader.close();
    return;
  }
  if (isActive) {
    // Same tab re-focused: reveal the existing translation instead of
    // re-translating from scratch (the DOM + session cache are preserved).
    if (reader.isOpen) reader.show();
    else void reader.open().catch(() => { /* context may be invalidated (reload) */ });
  } else if (reader.isOpen) {
    // Backgrounded tab: keep the translated DOM but hide it (and pause lazy
    // loading) so only the front tab shows a translation at a time.
    reader.hide();
  }
}

function syncBilingual(readingMode: 'off' | 'allowed' | 'everywhere', domains: readonly string[]): void {
  // 'everywhere' → always active here; 'allowed' → only on the shared domain
  // list; 'off' → never. Reuses the same scope logic as Radar auto-find.
  const active =
    readingMode === 'everywhere' ||
    (readingMode === 'allowed' && matchesDomain(location.hostname, domains));
  bilingualActiveHere = active;
  if (!active) {
    // Reading aids are off for this page: any local opt-out is moot.
    localBilingualOff = false;
    document.body.classList.remove('avs-bilingual-on');
    if (reader.isOpen) reader.close();
    return;
  }
  // Reading aids are on for this page. Open/refresh the reader directly here —
  // the scope decision is already made synchronously above, so we don't need
  // the worker's async am-i-active-tab check (which races with popup focus and
  // caused "Allow site requires a reload"). We only open when THIS tab is the
  // one the user is actually looking at (visibilityState), so a background tab
  // whose scope just became active stays dormant until it's focused — at which
  // point the broadcast `bilingual:reconcile` (→ reconcileBilingual) opens it.
  // That keeps the single-active-tab rule intact without a worker round-trip.
  if (localBilingualOff) {
    document.body.classList.remove('avs-bilingual-on');
    if (reader.isOpen) reader.close();
    return;
  }
  document.body.classList.add('avs-bilingual-on');
  if (document.visibilityState !== 'visible') return; // will open on tab focus
  if (reader.isOpen) reader.show();
  else void reader.open().catch(() => { /* context may be invalidated (reload) */ });
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
    const touchedContent = mutations.some((mutation) => {
      // Added/removed nodes (SPA route swaps, infinite scroll, lazy articles).
      const addedOwn = [...mutation.addedNodes].some((node) => !isOwnNode(node));
      if (addedOwn) return true;
      // Attribute changes that toggle a block's visibility (e.g. an SPA that
      // shows/hides two pre-rendered views via the `hidden` attribute or
      // inline `style`/`display`) — these swap the visible article WITHOUT
      // adding or removing any DOM node, so childList alone would miss them.
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        const attr = mutation.attributeName;
        if (attr === 'hidden' || attr === 'style' || attr === 'class' || attr === 'display') {
          return !isOwnNode(mutation.target);
        }
      }
      return false;
    });
    if (!touchedContent) return;

    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(() => scan(document.body), RESCAN_DELAY_MS);
    // New page content may contain Radar candidate words — re-apply radar
    // highlights (driven by the persisted list, no AI page scan).
    void sendMessage({ type: 'get-highlight-data' }).then((d) => {
      if (d) applyRadarHighlights(d.radar);
    }).catch(() => undefined);
    // The same content change may be an in-site (SPA) navigation that swapped
    // the visible article — re-derive Bilingual state and re-translate the new
    // view. BUT many mutations that flip `touchedContent` (e.g. re-highlighting
    // vocabulary words after a word is saved) leave the *article* content
    // untouched — the block set is identical, so re-translating would just flash
    // the whole page ("auto-reload") for no reason. Only re-translate when the
    // article's block set actually changed.
    const sig = extractArticle().map((b) => b.id).join('|');
    if (sig !== lastArticleSig) {
      lastArticleSig = sig;
      scheduleBilingualRefresh();
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'style', 'class', 'display'],
  });
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
    element.classList.contains(RADAR_HIGHLIGHT_CLASS) ||
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
    // Radar candidate highlight → open the Radar card (Save action).
    const radarMark =
      target instanceof Element ? target.closest(`.${RADAR_HIGHLIGHT_CLASS}`) : null;
    if (radarMark instanceof HTMLElement) {
      const item = radarByKey.get(radarMark.getAttribute(RADAR_HIGHLIGHT_ATTR) ?? '');
      if (item) {
        radarCard.show(radarMark, item);
        hoverCard.hide();
        return;
      }
    }

    const mark = target instanceof Element ? target.closest(`.${HIGHLIGHT_CLASS}`) : null;
    if (!(mark instanceof HTMLElement)) return;
    const entry = entriesById.get(mark.getAttribute(HIGHLIGHT_ATTR) ?? '');
    if (!entry) return;
    const settings = await settingsRepository.get();
    hoverCard.show(mark, entry, {
      showOriginal: true,
      showTranslation: isReadingActiveOnHost(settings, location.hostname),
    });
  };
  const closeFor = (event?: MouseEvent | FocusEvent): void => {
    // If the cursor is heading onto the card (or another highlight) don't close;
    // the card's own mouseenter keeps it open. Only defer when leaving toward the
    // page, so the user has time to cross the gap onto the card.
    const next = event instanceof MouseEvent ? event.relatedTarget : null;
    if (
      next instanceof Node &&
      (hoverCard.contains(next) ||
        radarCard.contains(next) ||
        (next as Element).closest?.(`.${HIGHLIGHT_CLASS}`) ||
        (next as Element).closest?.(`.${RADAR_HIGHLIGHT_CLASS}`))
    ) {
      return;
    }
    hoverCard.scheduleHide(220);
    radarCard.scheduleHide(220);
  };

  document.addEventListener('mouseover', (event) => openFor(event.target));
  document.addEventListener('mouseout', (event) => closeFor(event));
  document.addEventListener('focusin', (event) => openFor(event.target));
  document.addEventListener('focusout', () => closeFor());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hoverCard.hide();
      radarCard.hide();
    }
  });
}
