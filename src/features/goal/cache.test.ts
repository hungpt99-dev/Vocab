import { describe, expect, it } from 'vitest';
import { GoalAnalysisCache } from './cache';

describe('GoalAnalysisCache', () => {
  it('misses on first access and hits after set', () => {
    const cache = new GoalAnalysisCache();
    const url = 'https://example.com/article';
    const goalId = 'g1';
    const content = 'The API should be idempotent.';
    expect(cache.get(url, goalId, content)).toBeNull();

    const candidates = [{ text: 'idempotent', type: 'word' as const, score: 98, reason: 'x' }];
    cache.set(url, goalId, content, candidates);
    expect(cache.get(url, goalId, content)).toEqual(candidates);
  });

  it('misses when the goal changes', () => {
    const cache = new GoalAnalysisCache();
    const url = 'https://example.com/article';
    const content = 'The API should be idempotent.';
    cache.set(url, 'g1', content, []);
    expect(cache.get(url, 'g2', content)).toBeNull();
  });

  it('misses when the content changes', () => {
    const cache = new GoalAnalysisCache();
    const url = 'https://example.com/article';
    const goalId = 'g1';
    cache.set(url, goalId, 'original text', []);
    expect(cache.get(url, goalId, 'changed text')).toBeNull();
  });

  it('normalises the URL for the cache key', () => {
    const cache = new GoalAnalysisCache();
    const goalId = 'g1';
    const content = 'same content';
    cache.set('https://example.com/article?utm=1#frag', goalId, content, []);
    expect(cache.get('https://example.com/article', goalId, content)).toEqual([]);
  });

  it('expires entries after the TTL', () => {
    const cache = new GoalAnalysisCache(-1); // already expired
    const url = 'https://example.com/article';
    const goalId = 'g1';
    const content = 'content';
    cache.set(url, goalId, content, [{ text: 'x', type: 'word' as const, score: 90, reason: '' }]);
    expect(cache.get(url, goalId, content)).toBeNull();
  });

  it('clear wipes all entries', () => {
    const cache = new GoalAnalysisCache();
    cache.set('u', 'g', 'c', []);
    cache.clear();
    expect(cache.get('u', 'g', 'c')).toBeNull();
  });
});
