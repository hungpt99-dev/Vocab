/**
 * Opt-in debug logger for the bilingual reading pipeline.
 *
 * Off by default. Enable it ONCE from ANY DevTools console (page, popup, or
 * service worker) — it is stored in chrome.storage.local, which is shared by
 * the content script, popup, AND the service worker:
 *
 *   chrome.storage.local.set({ 'avs:debug-bilingual': true })
 *
 * Disable with:
 *   chrome.storage.local.set({ 'avs:debug-bilingual': false })
 *
 * Every line is prefixed `[avs:bilingual]` so it is easy to filter in the
 * console. The goal is to show *where* the slowness lives: chunking,
 * rate-limiter queueing, the provider round-trip, or DOM injection.
 */

const FLAG = 'avs:debug-bilingual';

type StorageArea = {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  onChanged?: {
    addListener(cb: (changes: Record<string, { newValue?: unknown }>, area: string) => void): void;
  };
};

function storage(): StorageArea | null {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) return chrome.storage.local as StorageArea;
  } catch {
    /* noop */
  }
  return null;
}

/** Cheap monotonic clock in milliseconds (performance.now when available). */
function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

// Cache the flag so logging is non-blocking; refreshed live via onChanged.
let enabledCache: boolean | null = null;

function refreshFromChanges(changes: Record<string, { newValue?: unknown }>, area: string): void {
  if (area !== 'local') return;
  if (FLAG in changes) enabledCache = changes[FLAG]?.newValue === true;
}

// Wire the live listener once (idempotent across imports).
const store = storage();
if (store?.onChanged && typeof enabledCache !== 'boolean') {
  // enabledCache stays null until first read resolves; the listener keeps it fresh.
  store.onChanged.addListener(refreshFromChanges);
}

async function isEnabled(): Promise<boolean> {
  if (enabledCache !== null) return enabledCache;
  const s = storage();
  if (!s) return false;
  try {
    const res = await s.get(FLAG);
    enabledCache = res[FLAG] === true;
  } catch {
    enabledCache = false;
  }
  return enabledCache;
}

function emit(where: 'content' | 'sw', args: unknown[]): void {
  // Fire-and-forget: never block the pipeline on logging.
  void isEnabled().then((on) => {
    if (on) console.log(`[avs:bilingual][${where}]`, ...args);
  });
}

export const bilingualLog = {
  /** Log from the content/page script. */
  content(...args: unknown[]): void {
    emit('content', args);
  },
  /** Log from the service worker. */
  sw(...args: unknown[]): void {
    emit('sw', args);
  },
};

/** A tiny stopwatch that returns an elapsed-ms formatter; no-op if disabled. */
export function contentTimer(label: string): { stop: (extra?: unknown) => void } {
  const start = nowMs();
  return {
    stop: (extra?: unknown): void => {
      const ms = Math.round(nowMs() - start);
      bilingualLog.content(`${label} took ${ms}ms`, extra ?? '');
    },
  };
}

/** A tiny stopwatch for the service worker. */
export function swTimer(label: string): { stop: (extra?: unknown) => void } {
  const start = nowMs();
  return {
    stop: (extra?: unknown): void => {
      const ms = Math.round(nowMs() - start);
      bilingualLog.sw(`${label} took ${ms}ms`, extra ?? '');
    },
  };
}
