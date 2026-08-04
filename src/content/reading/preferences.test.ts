import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_READING_PREFS,
  READING_PREFS_KEY,
  getReadingPreferences,
  setReadingPreferences,
  watchReadingPreferences,
} from './preferences';
import { chromeMock } from '@/test/chrome-mock';

describe('reading preferences', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getReadingPreferences()).toEqual(DEFAULT_READING_PREFS);
  });

  it('merges a stored patch over the defaults', async () => {
    await chromeMock().storage.local.set({ [READING_PREFS_KEY]: { layout: 'hover' } });
    expect(await getReadingPreferences()).toEqual({ ...DEFAULT_READING_PREFS, layout: 'hover' });
  });

  it('persists a patch and returns the merged result', async () => {
    const next = await setReadingPreferences({ layout: 'toggle' });
    expect(next.layout).toBe('toggle');
    expect((await chromeMock().storage.local.get(READING_PREFS_KEY))[READING_PREFS_KEY]).toMatchObject({
      layout: 'toggle',
    });
  });

  it('defaults the bilingual mode to word-by-word and persists a change', async () => {
    expect((await getReadingPreferences()).mode).toBe('word');
    const next = await setReadingPreferences({ mode: 'sentence' });
    expect(next.mode).toBe('sentence');
    expect((await getReadingPreferences()).mode).toBe('sentence');
  });

  it('clamps the font size to the supported range', async () => {
    expect((await setReadingPreferences({ fontSize: 99 })).fontSize).toBe(24);
    expect((await setReadingPreferences({ fontSize: 2 })).fontSize).toBe(12);
  });

  it('notifies listeners of changes and unsubscribes', async () => {
    const listener = vi.fn();
    const unsubscribe = watchReadingPreferences(listener);

    chromeMock().storage.onChanged.dispatch(
      { [READING_PREFS_KEY]: { newValue: { layout: 'original-first' } } },
      'local',
    );
    expect(listener).toHaveBeenCalledWith({ ...DEFAULT_READING_PREFS, layout: 'original-first' });

    unsubscribe();
    chromeMock().storage.onChanged.dispatch(
      { [READING_PREFS_KEY]: { newValue: { layout: 'hover' } } },
      'local',
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
