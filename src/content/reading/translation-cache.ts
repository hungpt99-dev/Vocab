/**
 * Per-session cache of bilingual translation results.
 *
 * Why this exists: the InlineReader's "don't re-translate" guard lives only in
 * memory and is wiped on `close()` and on page reload, so reopening a page (or
 * switching tabs away and back) re-runs the entire translation pipeline — new AI
 * calls, skeleton flash, the works — even though the page was already translated.
 * This cache stores results keyed by the *source text* (plus target language and
 * mode), so a reopened page reuses what it already translated.
 *
 * Keyed by source text, not by the random per-extraction block id
 * (`extract.ts` uses `createId()`), so the cache survives re-extraction and
 * reloads. Stored in `chrome.storage.session`, which is shared across content
 * scripts and the service worker within one browser session but is cleared on
 * restart — fresh translations after a full restart are acceptable.
 */

const STORAGE_KEY = 'avs:bilingual-cache';
const MAX_ENTRIES = 4000; // bound memory; ~one long article mid-session

const SESSION_AVAILABLE = (): boolean =>
  typeof chrome !== 'undefined' && Boolean(chrome.storage?.session);

let memoryFallback: Map<string, string> | null = null;

function memory(): Map<string, string> {
  if (!memoryFallback) memoryFallback = new Map();
  return memoryFallback;
}

function area(): { get(k: string): Promise<Record<string, string>>; set(v: Record<string, string>): Promise<void> } {
  if (SESSION_AVAILABLE()) {
    const session = chrome.storage.session as chrome.storage.SessionStorageArea;
    return {
      // chrome.storage returns a record keyed by the requested key; the value is
      // whatever we stored (the JSON string of the cache object).
      get: (k) => session.get(k).then((r) => (r as Record<string, string>) ?? {}),
      set: (v) => session.set(v).then(() => undefined),
    };
  }
  // jsdom / non-extension host: keep a process-local map so the unit tests can
  // exercise cache hit/miss without a real storage backend. The contract is the
  // same: values are JSON strings, keyed by STORAGE_KEY.
  return {
    get: async (k) => {
      const raw = memory().get(k);
      return raw ? { [k]: raw } : {};
    },
    set: async (v) => {
      for (const [key, value] of Object.entries(v)) memory().set(key, value);
    },
  };
}

/** Stable cache key for a translatable unit. */
export function cacheKey(sourceText: string, language: string, mode: 'word' | 'sentence'): string {
  const norm = sourceText.replace(/\s+/g, ' ').trim();
  return `${mode}|${language}|${norm}`;
}

/** A cached translation worth reusing on reopen. */
export interface CachedTranslation {
  /** The rendered translation line (sentence mode, or word-mode fallback line). */
  translation: string;
  /** Word-alignment pairs, present only in word mode; null in sentence mode. */
  pairs: Array<{ source: string; target: string }> | null;
}

export interface TranslationCache {
  /** Return cached translations for the given keys, or undefined if absent. */
  get(keys: string[]): Promise<Map<string, CachedTranslation>>;
  /** Store translations keyed by `cacheKey(...)`. */
  set(entries: Map<string, CachedTranslation>): Promise<void>;
}

/** Read the full cache object (all key -> JSON string), or an empty object. */
async function loadAll(): Promise<Record<string, string>> {
  const store = area();
  try {
    const result = await store.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function saveAll(all: Record<string, string>): Promise<void> {
  const store = area();
  try {
    await store.set({ [STORAGE_KEY]: JSON.stringify(all) });
  } catch {
    // Storage unavailable / quota — translation still works, just uncached.
  }
}

export const translationCache: TranslationCache = {
  async get(keys: string[]): Promise<Map<string, CachedTranslation>> {
    const all = await loadAll();
    const out = new Map<string, CachedTranslation>();
    for (const key of keys) {
      const raw = all[key];
      if (raw === undefined) continue;
      try {
        const parsed = JSON.parse(raw) as CachedTranslation;
        if (parsed && typeof parsed.translation === 'string') out.set(key, parsed);
      } catch {
        // Corrupt entry — ignore and let it be re-translated.
      }
    }
    return out;
  },

  async set(entries: Map<string, CachedTranslation>): Promise<void> {
    if (entries.size === 0) return;
    const all = await loadAll();
    for (const [key, value] of entries) {
      if (value && value.translation) all[key] = JSON.stringify(value);
    }
    // Bound the cache so a long session of reading many articles can't grow it
    // without limit. Evict oldest (first-inserted) entries when over the cap.
    const keys = Object.keys(all);
    if (keys.length > MAX_ENTRIES) {
      for (const stale of keys.slice(0, keys.length - MAX_ENTRIES)) delete all[stale];
    }
    await saveAll(all);
  },
};
