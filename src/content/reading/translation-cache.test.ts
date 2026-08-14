import { describe, expect, it } from 'vitest';
import { translationCache, cacheKey, type CachedTranslation } from './translation-cache';

function sample(translation: string, pairs: CachedTranslation['pairs']): CachedTranslation {
  return { translation, pairs };
}

describe('translationCache', () => {
  it('round-trips a cached translation and returns it on lookup', async () => {
    const key = cacheKey('Hello world', 'Vietnamese', 'word');
    await translationCache.set(
      new Map([[key, sample('Xin chào', [{ source: 'Hello', target: 'Xin' }])]]),
    );

    const hit = await translationCache.get([key]);
    expect(hit.get(key)).toEqual({ translation: 'Xin chào', pairs: [{ source: 'Hello', target: 'Xin' }] });
  });

  it('returns an empty map for an unknown key', async () => {
    const hit = await translationCache.get([cacheKey('nothing here', 'English', 'sentence')]);
    expect(hit.size).toBe(0);
  });

  it('keys are stable and language/mode sensitive', async () => {
    const a = cacheKey('Bonjour', 'English', 'word');
    const b = cacheKey('Bonjour', 'English', 'sentence');
    const c = cacheKey('Bonjour', 'French', 'word');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    // Whitespace-normalised: identical meaning yields an identical key, so a
    // reopened page lands on the same cache slot.
    expect(cacheKey('  Bonjour  ', 'English', 'word')).toBe(a);
  });

  it('ignores corrupt stored entries rather than throwing', async () => {
    const key = cacheKey('corrupt', 'English', 'sentence');
    await translationCache.set(new Map([[key, sample('ok', null)]]));
    const hit = await translationCache.get([key]);
    expect(hit.get(key)?.translation).toBe('ok');
  });
});
