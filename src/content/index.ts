import { registerMessageHandlers } from '@/shared/messaging/router';
import { SETTINGS_KEY, settingsRepository } from '@/storage/settings-repository';
import { sendMessage } from '@/shared/messaging/client';
import type { ExplainKind } from '@/shared/types/ai';
import type { HighlightData } from '@/shared/messaging/contract';
import { isRadarEnabled, isReadingActiveOnHost } from '@/shared/types/settings';
import { HIGHLIGHT_ATTR, HIGHLIGHT_CLASS, highlightRoot, removeHighlights } from './highlighter';
import {
  highlightRadarRoot,
  removeRadarHighlights,
  type RadarMatchEntry,
} from './highlighter';
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
import { installSpaNavHandler } from './spa';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { normalizeFamilyKey } from '@/features/radar/rank';
// The inline reader imports from './domain' directly to keep the module graph
// acyclic; this import+re-export keeps `matchesDomain` available at the entry
// (and in the entry's tests) without the old circular dependency.
import { matchesDomain } from './domain';
export { matchesDomain };

const RESCAN_DELAY_MS = 400;
/** Debounce for radar auto-scan re-runs (settings change, SPA nav, lazy load). */
const RADAR_RESCAN_MS = 1500;
/** Minimum gap between two real radar analyses, so a burst of mutations or
 * rapid settings writes can't trigger a storm of expensive AI calls. */
const RADAR_MIN_INTERVAL_MS = 4000;

const hoverCard = new HoverCard();
const toolbar = new SelectionCard();
const reader = new InlineReader();

/** Latest settings snapshot, kept in sync by refresh(); used for keyless gating. */
let currentSettings: import('@/shared/types/settings').Settings | null = null;

/** Guards so overlapping radar scans don't multiply API calls. */
let radarScanning = false;
let radarRescanTimer: ReturnType<typeof setTimeout> | undefined;
let lastRadarRunAt = 0;
/** Content hash of the last text we analyzed, to skip no-op rescans. */
let lastRadarContentHash = '';

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
  'bilingual:refresh': () => void reader.refresh(),
  'bilingual:reconcile': () => void reconcileBilingual(),
  'radar:scan': (message) => runRadarScanHere(message.payload?.goal),
});

void bootstrap();

async function bootstrap(): Promise<void> {
  injectStyles();
  attachHoverListeners();
  attachSelectionToolbar();
  watchSettings();
  // Re-translate after an in-tab (SPA) navigation: client-side routers swap the
  // page without a full reload, so nothing else re-triggers Bilingual.
  installSpaNavHandler(scheduleBilingualRefresh);
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
      // Radar auto-scan is debounced + guarded inside scheduleRadarAutoScan, so a
      // settings change that also triggers refresh() won't start two scans.
      scheduleRadarAutoScan();
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

  // Vocabulary Radar auto-scan (VOC-134): if enabled for this domain, analyse
  // the page automatically and highlight radar-relevant words inline.
  // Debounced + guarded so it never races with a concurrent scan.
  scheduleRadarAutoScan();
}

/** Cheap, non-cryptographic content hash (FNV-1a) for change detection. */
function fnv1aHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Build the set of vocabulary "families" the user already knows (saved words).
 * Both sides of the radar filter run through `normalizeFamilyKey`, so a saved
 * lemma like "run" suppresses "runs"/"running" on the page. Deterministic and
 * model-free, so it works even before the AI is asked — no wasted suggestions.
 */
async function buildKnownFamilies(): Promise<string[]> {
  const entries = await vocabularyRepository.list();
  const families = new Set<string>();
  for (const entry of entries) {
    if (entry.lemma) families.add(normalizeFamilyKey(entry.lemma));
    if (entry.normalizedForm) families.add(normalizeFamilyKey(entry.normalizedForm));
    families.add(normalizeFamilyKey(entry.word));
  }
  return [...families];
}

/**
 * Run a Radar scan for the *current page* (invoked from the popup via the
 * background, or directly). Extracts the article text, asks the background to
 * analyse it against the user's Radar goal, then highlights the results inline.
 * The page does the extraction itself so it always reads its own content — this
 * is what fixes the old bug where the background resolved the popup's tab.
 *
 * `goalOverride` lets a caller (e.g. Radar Quick Search) reuse this exact
 * pipeline with an ad-hoc goal without changing the saved Settings goal.
 *
 * Personalization, dedup and rate-limit guards live here so Radar v2 stays
 * quality-first and never multiplies AI calls:
 *  - known families are computed and sent so the worker drops already-known
 *    words before they ever reach the user;
 *  - a content hash + min-interval guard skips no-op / back-to-back rescans.
 */
async function runRadarScanHere(
  goalOverride?: string,
): Promise<import('@/features/radar/radar-service').AnalyzePageResult> {
  const settings = await settingsRepository.get();
  const goal = goalOverride?.trim() || settings.radar?.goal?.trim() || '';
  if (!goal) {
    return { candidates: [], chunksAnalyzed: 0, chunksTotal: 0, partial: false };
  }
  const blocks = extractArticle();
  const pageText = blocks.map((block) => block.text).join('\n\n');
  if (!pageText.trim()) {
    return { candidates: [], chunksAnalyzed: 0, chunksTotal: 0, partial: false };
  }

  const contentHash = fnv1aHash(pageText);
  // Skip if the page content hasn't changed since the last analysis and we are
  // within the minimum interval — this is what stops SPA/infinite-scroll
  // mutations and rapid settings writes from re-triggering a full scan.
  if (contentHash === lastRadarContentHash && Date.now() - lastRadarRunAt < RADAR_MIN_INTERVAL_MS) {
    return { candidates: [], chunksAnalyzed: 0, chunksTotal: 0, partial: false };
  }

  const knownFamilies = await buildKnownFamilies();
  const result = await sendMessage({
    type: 'radar:analyze',
    payload: { goal, pageUrl: location.href, pageText, knownFamilies },
  });
  lastRadarContentHash = contentHash;
  lastRadarRunAt = Date.now();

  removeRadarHighlights();
  if (result && result.candidates.length > 0) {
    // Inline-highlight only the high-value tier (Radar v2: quality over noise).
    // The full ranked list is always available in the popup.
    const entries: RadarMatchEntry[] = result.candidates
      .filter((c) => c.tier === 'high')
      .map((c) => ({ key: c.key, text: c.text, tier: c.tier }));
    if (entries.length > 0) highlightRadarRoot(document.body, entries);
  }
  return result ?? { candidates: [], chunksAnalyzed: 0, chunksTotal: 0, partial: false };
}

/**
 * Automatically analyse the current page for radar-relevant vocabulary and
 * highlight the high-value candidates inline — only when Radar is enabled for
 * this domain (reusing the per-site domain pattern from Bilingual). Safe no-op
 * otherwise; the manual popup scan remains available in all cases.
 *
 * Guarded so a burst of triggers (settings change, SPA nav, lazy-loaded content)
 * collapses into at most one in-flight scan: overlapping calls are skipped, and
 * repeat triggers are debounced to RADAR_RESCAN_MS.
 */
function scheduleRadarAutoScan(): void {
  clearTimeout(radarRescanTimer);
  radarRescanTimer = setTimeout(() => {
    void runRadarAutoScan();
  }, RADAR_RESCAN_MS);
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
  if (!bilingualActiveHere || localBilingualOff) return;
  clearTimeout(bilingualRefreshTimer);
  // SPAs mount the new route asynchronously (data fetch / transition), so the
  // article may not exist yet at nav time. Poll briefly for content, then
  // (re)open the reader. `reader.refresh()` handles both already-open (in-place)
  // and not-yet-open (fresh) states; the only requirement is that the new DOM
  // has actually painted before we call it.
  let attempts = 0;
  const attempt = () => {
    if (extractArticle().length > 0) {
      void reader.refresh();
      return;
    }
    if (attempts++ < SPA_REFRESH_MAX_ATTEMPTS) {
      bilingualRefreshTimer = window.setTimeout(attempt, SPA_REFRESH_POLL_MS);
    }
  };
  bilingualRefreshTimer = window.setTimeout(attempt, SPA_REFRESH_MS);
}

async function runRadarAutoScan(): Promise<void> {
  if (radarScanning) return;
  let settings: import('@/shared/types/settings').Settings;
  try {
    settings = await settingsRepository.get();
  } catch {
    return;
  }
  if (!isRadarEnabled(settings)) {
    removeRadarHighlights();
    return;
  }
  // Respect the shared reading scope: 'allowed' limits Radar auto-find to the
  // shared allowedDomains; 'everywhere' runs it on every readable page.
  if (settings.readingMode === 'allowed') {
    const host = location.hostname.replace(/^www\./i, '').toLowerCase();
    if (!matchesDomain(host, settings.allowedDomains)) {
      removeRadarHighlights();
      return;
    }
  }

  radarScanning = true;
  try {
    await runRadarScanHere();
  } catch {
    // Auto-scan failures are non-fatal: the page stays readable; the manual
    // popup scan can surface the real error if the user retries.
  } finally {
    radarScanning = false;
  }
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
    else void reader.open();
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
  else void reader.open();
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
    // Dynamic content (SPA route changes, infinite scroll, lazy-loaded
    // articles) should be re-checked by Radar. scheduleRadarAutoScan debounces
    // and guards this so we never multiply AI calls on a busy mutation stream,
    // and runRadarScanHere itself short-circuits when the page text is
    // unchanged since the last analysis.
    scheduleRadarAutoScan();
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
      showTranslation: isReadingActiveOnHost(settings, location.hostname),
    });
  };
  const closeFor = (event?: MouseEvent | FocusEvent): void => {
    // If the cursor is heading onto the card (or another highlight) don't close;
    // the card's own mouseenter keeps it open. Only defer when leaving toward the
    // page, so the user has time to cross the gap onto the card.
    const next = event instanceof MouseEvent ? event.relatedTarget : null;
    if (next instanceof Node && (hoverCard.contains(next) || (next as Element).closest?.(`.${HIGHLIGHT_CLASS}`))) {
      return;
    }
    hoverCard.scheduleHide(220);
  };

  document.addEventListener('mouseover', (event) => openFor(event.target));
  document.addEventListener('mouseout', (event) => closeFor(event));
  document.addEventListener('focusin', (event) => openFor(event.target));
  document.addEventListener('focusout', () => closeFor());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hoverCard.hide();
  });
}
