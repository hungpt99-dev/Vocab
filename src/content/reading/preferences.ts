export const READING_PREFS_KEY = 'avs:reading';

export type ReadingLayout = 'side-by-side' | 'original-first' | 'translation-first' | 'hover' | 'toggle';

/**
 * How a block is broken into rows:
 *  - `paragraph`  — one row per article block (headings/paragraphs), the default.
 *  - `sentence`   — bilingual-book: one row per sentence, English over its
 *    translation on the facing line.
 */
export type ReadingAlignment = 'paragraph' | 'sentence';

export interface ReadingPreferences {
  layout: ReadingLayout;
  alignment: ReadingAlignment;
  /** Base font size of the reader body in px (clamped 12–24). */
  fontSize: number;
  highlightVocabulary: boolean;
}

export const DEFAULT_READING_PREFS: ReadingPreferences = {
  layout: 'side-by-side',
  alignment: 'paragraph',
  fontSize: 16,
  highlightVocabulary: true,
};

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 24;

export function clampFontSize(value: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
}

function mergePrefs(value: unknown): ReadingPreferences {
  const patch = (typeof value === 'object' && value !== null ? value : {}) as Partial<ReadingPreferences>;
  return {
    ...DEFAULT_READING_PREFS,
    ...patch,
    fontSize: clampFontSize(typeof patch.fontSize === 'number' ? patch.fontSize : DEFAULT_READING_PREFS.fontSize),
  };
}

/** Read the persisted reading-mode preferences, merging in defaults. */
export async function getReadingPreferences(): Promise<ReadingPreferences> {
  const stored = await chrome.storage.local.get(READING_PREFS_KEY);
  return mergePrefs(stored[READING_PREFS_KEY]);
}

/** Persist a patch and return the merged result. */
export async function setReadingPreferences(patch: Partial<ReadingPreferences>): Promise<ReadingPreferences> {
  const current = await getReadingPreferences();
  const fontSize = clampFontSize(patch.fontSize ?? current.fontSize);
  const next = { ...current, ...patch, fontSize };
  await chrome.storage.local.set({ [READING_PREFS_KEY]: next });
  return next;
}

/** Subscribe to preference changes; returns an unsubscribe function. */
export function watchReadingPreferences(listener: (prefs: ReadingPreferences) => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !changes[READING_PREFS_KEY]) return;
    listener(mergePrefs(changes[READING_PREFS_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
