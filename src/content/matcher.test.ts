import { describe, expect, it } from 'vitest';
import { VocabularyMatcher, type HighlightEntry } from './matcher';

function entry(word: string, id = word): HighlightEntry {
  return { id, word, wordKey: word.toLowerCase(), note: '', createdAt: 1, meaning: '', pronunciation: '', explanation: null };
}

describe('VocabularyMatcher', () => {
  it('reports its size', () => {
    expect(new VocabularyMatcher([entry('cake'), entry('pie')]).size).toBe(2);
  });

  it('matches whole words case-insensitively', () => {
    const matches = new VocabularyMatcher([entry('cake')]).findAll('I ate Cake today.');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.entry.word).toBe('cake');
  });

  it('does not match inside longer words', () => {
    expect(new VocabularyMatcher([entry('cake')]).findAll('cupcakes and pancakes')).toEqual([]);
  });

  it('matches multi-word phrases', () => {
    const matches = new VocabularyMatcher([entry('piece of cake')]).findAll('It was a piece of cake.');
    expect(matches[0]?.entry.word).toBe('piece of cake');
  });

  it('prefers the longest match', () => {
    const matcher = new VocabularyMatcher([entry('cake'), entry('piece of cake')]);
    const matches = matcher.findAll('a piece of cake');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.entry.word).toBe('piece of cake');
  });

  it('finds several occurrences with correct offsets', () => {
    const matches = new VocabularyMatcher([entry('cake')]).findAll('cake and cake');
    expect(matches.map((m) => [m.start, m.end])).toEqual([
      [0, 4],
      [9, 13],
    ]);
  });

  it('handles regex metacharacters in saved words', () => {
    expect(new VocabularyMatcher([entry('c++')]).findAll('I write c++ daily')).toHaveLength(1);
  });

  it('returns nothing when empty', () => {
    expect(new VocabularyMatcher([]).findAll('anything')).toEqual([]);
    expect(new VocabularyMatcher([entry('cake')]).findAll('')).toEqual([]);
  });
});
