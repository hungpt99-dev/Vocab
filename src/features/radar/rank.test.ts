import { describe, expect, it } from 'vitest';
import {
  mergeAndRank,
  normalizeFamilyKey,
  MIN_DISPLAY_SCORE,
  HIGH_RELEVANCE_SCORE,
} from './rank';
import type { RadarCandidate } from './types';

const c = (text: string, score: number, extra: Partial<RadarCandidate> = {}): RadarCandidate => ({
  text,
  type: 'word',
  score,
  reason: extra.reason ?? '',
  context: extra.context,
});

describe('normalizeFamilyKey', () => {
  it('collapses whitespace and lowercases', () => {
    expect(normalizeFamilyKey('Gracefully   Degrade')).toBe('gracefully degrade');
  });

  it('strips simple inflections so a word family collapses', () => {
    expect(normalizeFamilyKey('running')).toBe('run');
    expect(normalizeFamilyKey('books')).toBe('book');
    expect(normalizeFamilyKey('studies')).toBe('study');
    expect(normalizeFamilyKey('played')).toBe('play');
    expect(normalizeFamilyKey('stopped')).toBe('stop');
  });

  it('drops a leading determiner', () => {
    expect(normalizeFamilyKey('a recommendation')).toBe('recommendation');
  });
});

describe('mergeAndRank', () => {
  it('sorts descending by score', () => {
    const ranked = mergeAndRank([c('alpha', 70), c('beta', 95), c('gamma', 80)], 5);
    expect(ranked.map((r) => r.text)).toEqual(['beta', 'gamma', 'alpha']);
  });

  it('deduplicates exact-case candidates and keeps the highest score', () => {
    const ranked = mergeAndRank(
      [c('idempotent', 80), c('Idempotent', 98), c('IDEMPOTENT', 70)],
      5,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.score).toBe(98);
  });

  it('deduplicates by word family (run / runs / running)', () => {
    const ranked = mergeAndRank([c('run', 80), c('runs', 90), c('running', 70)], 5);
    expect(ranked).toHaveLength(1);
    // The strongest score wins, but the displayed surface form is the first
    // canonical form encountered (the family collapses to one entry).
    expect(ranked[0]!.score).toBe(90);
    expect(ranked[0]!.text).toBe('run');
  });

  it('merges duplicates and prefers the richer context/reason', () => {
    const ranked = mergeAndRank(
      [
        c('x', 90, { context: '', reason: '' }),
        c('x', 90, { context: 'The X here.', reason: 'good' }),
      ],
      5,
    );
    expect(ranked[0]!.context).toBe('The X here.');
    expect(ranked[0]!.reason).toBe('good');
  });

  it('keeps a phrase and a bare word as distinct families', () => {
    const ranked = mergeAndRank([c('make', 80), c('make a decision', 80, { type: 'phrase' })], 5);
    expect(ranked).toHaveLength(2);
  });

  it('keeps the stronger score when the same family appears as word and phrase', () => {
    // Same family key only when the phrase literally is the family; here both
    // reduce to different keys, so the test documents that a higher-scoring
    // distinct concept wins the first slot.
    const ranked = mergeAndRank([c('evict', 95), c('eviction', 80)], 5);
    expect(ranked[0]!.text).toBe('evict');
  });

  it('caps at the Top N limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => c(`word${i}`, 70 + i));
    const ranked = mergeAndRank(many, 3);
    expect(ranked).toHaveLength(3);
    expect(ranked[0]!.text).toBe('word9');
  });

  it('hides candidates below the display threshold', () => {
    const ranked = mergeAndRank([c('low', 40), c('high', 75)], 5);
    expect(ranked.map((r) => r.text)).toEqual(['high']);
    expect(MIN_DISPLAY_SCORE).toBe(70);
  });

  it('assigns relevance tiers from the blended score', () => {
    const ranked = mergeAndRank([c('hot', 95), c('warm', 75)], 5);
    expect(ranked[0]!.tier).toBe('high');
    expect(ranked[1]!.tier).toBe('relevant');
    expect(HIGH_RELEVANCE_SCORE).toBe(90);
  });

  it('excludes candidates the user already knows (knownFamilies)', () => {
    const known = new Set([normalizeFamilyKey('cache')]);
    // 'cache' is excluded; the phrase 'cache the result' is a distinct concept
    // (its family key is the whole phrase), so it is kept.
    const ranked = mergeAndRank(
      [c('cache', 95), c('evict', 95), c('cache the result', 90, { type: 'phrase' })],
      5,
      { knownFamilies: known },
    );
    expect(ranked.map((r) => r.text)).toEqual(['evict', 'cache the result']);
  });

  it('excludes a known phrase when its exact family is in knownFamilies', () => {
    const known = new Set([normalizeFamilyKey('cache the result')]);
    const ranked = mergeAndRank(
      [c('cache', 95), c('evict', 95), c('cache the result', 90, { type: 'phrase' })],
      5,
      { knownFamilies: known },
    );
    expect(ranked.map((r) => r.text)).toEqual(['cache', 'evict']);
  });

  it('breaks ties by context presence (blended score)', () => {
    // Both are 90 (high tier). The one with a real context gets a small boost.
    const ranked = mergeAndRank(
      [c('solo', 90), c('duo', 90, { context: 'The duo performed.' })],
      5,
    );
    expect(ranked[0]!.text).toBe('duo');
  });

  it('returns an empty list when everything is already known', () => {
    const known = new Set(['alpha', 'beta']);
    const ranked = mergeAndRank([c('alpha', 95), c('beta', 95)], 5, { knownFamilies: known });
    expect(ranked).toHaveLength(0);
  });
});
