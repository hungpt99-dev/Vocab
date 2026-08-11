import { describe, expect, it } from 'vitest';
import { RadarAnalysisCache } from './cache';

describe('RadarAnalysisCache', () => {
  it('misses on first access and hits after set', () => {
    const cache = new RadarAnalysisCache();
    const url = 'https://example.com/article';
    const goal = 'learn backend english';
    const content = 'The API should be idempotent.';
    expect(cache.get(url, goal, content)).toBeNull();

    const candidates = [{ text: 'idempotent', type: 'word' as const, score: 98, reason: 'x' }];
    cache.set(url, goal, content, candidates);
    expect(cache.get(url, goal, content)).toEqual(candidates);
  });

  it('misses when the goal changes', () => {
    const cache = new RadarAnalysisCache();
    const url = 'https://example.com/article';
    const content = 'The API should be idempotent.';
    cache.set(url, 'learn backend english', content, []);
    expect(cache.get(url, 'learn frontend english', content)).toBeNull();
  });

  it('misses when the content changes', () => {
    const cache = new RadarAnalysisCache();
    const url = 'https://example.com/article';
    const goal = 'learn backend english';
    cache.set(url, goal, 'original text', []);
    expect(cache.get(url, goal, 'changed text')).toBeNull();
  });

  it('normalises the URL for the cache key', () => {
    const cache = new RadarAnalysisCache();
    const goal = 'learn backend english';
    const content = 'same content';
    cache.set('https://example.com/article?utm=1#frag', goal, content, []);
    expect(cache.get('https://example.com/article', goal, content)).toEqual([]);
  });

  it('expires entries after the TTL', () => {
    const cache = new RadarAnalysisCache(-1); // already expired
    const url = 'https://example.com/article';
    const goal = 'learn backend english';
    const content = 'content';
    cache.set(url, goal, content, [{ text: 'x', type: 'word' as const, score: 90, reason: '' }]);
    expect(cache.get(url, goal, content)).toBeNull();
  });

  it('clear wipes all entries', () => {
    const cache = new RadarAnalysisCache();
    cache.set('u', 'g', 'c', []);
    cache.clear();
    expect(cache.get('u', 'g', 'c')).toBeNull();
  });
});
