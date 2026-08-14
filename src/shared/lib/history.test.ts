import { describe, expect, it } from 'vitest';
import { buildHistory, countInWindow } from './history';
import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { makeVocabularyEntry } from '@/test/factories';

const DAY = 24 * 60 * 60 * 1000;

function entry(createdAt: number): VocabularyEntry {
  return makeVocabularyEntry({
    id: `id-${createdAt}`,
    word: 'w',
    wordKey: `k-${createdAt}`,
    sourceLanguage: 'en',
    createdAt,
    updatedAt: createdAt,
  });
}

describe('buildHistory', () => {
  const NOW = new Date('2026-08-07T12:00:00Z').getTime();

  it('returns one point per day for the window, oldest first', () => {
    const points = buildHistory([entry(NOW)], 14, NOW);
    expect(points).toHaveLength(14);
    expect(points[0]!.date <= points[13]!.date).toBe(true);
  });

  it('counts words saved on the same day', () => {
    const points = buildHistory([entry(NOW), entry(NOW), entry(NOW - 2 * DAY)], 14, NOW);
    const today = points[points.length - 1]!;
    expect(today.count).toBe(2);
    expect(points[points.length - 3]!.count).toBe(1);
  });

  it('fills zero on days with no saves', () => {
    const points = buildHistory([entry(NOW)], 14, NOW);
    const zeros = points.filter((p) => p.count === 0).length;
    expect(zeros).toBe(13);
  });
});

describe('countInWindow', () => {
  const NOW = new Date('2026-08-07T12:00:00Z').getTime();

  it('counts only words within the trailing window', () => {
    const entries = [entry(NOW), entry(NOW - 3 * DAY), entry(NOW - 10 * DAY)];
    expect(countInWindow(entries, 7, NOW)).toBe(2);
  });
});
