/**
 * Opt-in debug logger for the bilingual reading pipeline.
 *
 * Off by default. Enable from the page or service-worker DevTools console:
 *
 *   localStorage.setItem('avs:debug-bilingual', '1')   // content script side
 *   // service-worker side reads the same key from chrome.storage.local
 *
 * Every line is prefixed `[avs:bilingual]` so it is easy to filter in the
 * console. The goal is to show *where* the slowness lives: chunking,
 * rate-limiter queueing, the provider round-trip, or DOM injection.
 */

const CONTENT_FLAG = 'avs:debug-bilingual';
const SW_FLAG = 'avs:debug-bilingual';

/** Cheap monotonic clock in milliseconds (performance.now when available). */
function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** Read the flag on the content/page side. */
function contentEnabled(): boolean {
  try {
    return localStorage.getItem(CONTENT_FLAG) === '1';
  } catch {
    return false;
  }
}

/** Read the flag on the service-worker side (fresh each call; cheap). */
function swEnabled(): boolean {
  try {
    return localStorage.getItem(SW_FLAG) === '1';
  } catch {
    return false;
  }
}

export const bilingualLog = {
  /** Log from the content/page script. */
  content(...args: unknown[]): void {
    if (contentEnabled()) console.log('[avs:bilingual]', ...args);
  },
  /** Log from the service worker. */
  sw(...args: unknown[]): void {
    if (swEnabled()) console.log('[avs:bilingual]', ...args);
  },
};

/** A tiny stopwatch that returns an elapsed-ms formatter; null if disabled. */
export function contentTimer(label: string): { stop: (extra?: unknown) => void } | null {
  if (!contentEnabled()) return null;
  const start = nowMs();
  return {
    stop: (extra?: unknown): void => {
      const ms = Math.round(nowMs() - start);
      bilingualLog.content(`${label} took ${ms}ms`, extra ?? '');
    },
  };
}

/** A tiny stopwatch for the service worker. */
export function swTimer(label: string): { stop: (extra?: unknown) => void } | null {
  if (!swEnabled()) return null;
  const start = nowMs();
  return {
    stop: (extra?: unknown): void => {
      const ms = Math.round(nowMs() - start);
      bilingualLog.sw(`${label} took ${ms}ms`, extra ?? '');
    },
  };
}
