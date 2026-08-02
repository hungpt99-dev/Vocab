import { describe, expect, it } from 'vitest';
import {
  collapseWhitespace,
  escapeRegExp,
  extractSentence,
  isPhrase,
  normalizeTag,
  normalizeTags,
  normalizeWord,
} from './text';

describe('normalizeWord', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalizeWord('  Serendipity  ')).toBe('serendipity');
    expect(normalizeWord('Piece   of\ncake')).toBe('piece of cake');
  });
});

describe('normalizeTag', () => {
  it('strips leading hashes', () => {
    expect(normalizeTag('##Business')).toBe('business');
  });
});

describe('normalizeTags', () => {
  it('de-duplicates, sorts and drops empties', () => {
    expect(normalizeTags(['B', 'a', '  ', 'b', '#A'])).toEqual(['a', 'b']);
  });
});

describe('collapseWhitespace', () => {
  it('preserves case', () => {
    expect(collapseWhitespace('  Hello   World ')).toBe('Hello World');
  });
});

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    const escaped = escapeRegExp('a.b*c(d)');
    expect(new RegExp(escaped).test('a.b*c(d)')).toBe(true);
    expect(new RegExp(escaped).test('axbxcd')).toBe(false);
  });
});

describe('isPhrase', () => {
  it('detects multi-word selections', () => {
    expect(isPhrase('piece of cake')).toBe(true);
    expect(isPhrase(' word ')).toBe(false);
  });
});

describe('extractSentence', () => {
  const text = 'I love cake. Serendipity struck me today! Then I left.';

  it('returns the sentence containing the selection', () => {
    expect(extractSentence(text, 'Serendipity')).toBe('Serendipity struck me today!');
  });

  it('is case insensitive', () => {
    expect(extractSentence(text, 'serendipity')).toContain('Serendipity');
  });

  it('falls back to the selection when not found', () => {
    expect(extractSentence(text, 'absent')).toBe('absent');
  });

  it('handles empty input', () => {
    expect(extractSentence('', 'word')).toBe('word');
  });
});
