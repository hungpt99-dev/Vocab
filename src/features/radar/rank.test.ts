import { describe, expect, it } from 'vitest';
import { mergeAndRank, normalizeCandidateKey, MIN_DISPLAY_SCORE } from './rank';
import type { RadarCandidate } from './types';

const c = (text: string, score: number, extra: Partial<RadarCandidate> = {}): RadarCandidate => ({
  text,
  type: 'word',
  score,
  reason: extra.reason ?? '',
  context: extra.context,
});

describe('normalizeCandidateKey', () => {
  it('collapses whitespace and lowercases', () => {
    expect(normalizeCandidateKey('Gracefully   Degrade')).toBe('gracefully degrade');
  });
});

describe('mergeAndRank', () => {
  it('sorts descending by score', () => {
    const ranked = mergeAndRank([c('alpha', 70), c('beta', 95), c('gamma', 80)], 5);
    expect(ranked.map((r) => r.text)).toEqual(['beta', 'gamma', 'alpha']);
  });

  it('deduplicates equivalent candidates and keeps the highest score', () => {
    const ranked = mergeAndRank(
      [c('idempotent', 80), c('Idempotent', 98), c('IDEMPOTENT', 70)],
      5,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.score).toBe(98);
  });

  it('prefers the better context and reason on duplicate merge', () => {
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

  it('assigns relevance tiers', () => {
    const ranked = mergeAndRank([c('hot', 95), c('warm', 75)], 5);
    expect(ranked[0]!.tier).toBe('high');
    expect(ranked[1]!.tier).toBe('relevant');
  });
});
