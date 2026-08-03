import { describe, expect, it } from 'vitest';
import {
  collapseWhitespace,
  escapeRegExp,
  extractSentence,
  isPhrase,
  normalizeTag,
  normalizeTags,
  normalizeWord,
  splitIntoSentences,
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

describe('splitIntoSentences', () => {
  it('splits on terminal punctuation', () => {
    expect(splitIntoSentences('Hello world. Goodbye now! Really?')).toEqual([
      'Hello world.',
      'Goodbye now!',
      'Really?',
    ]);
  });

  it('handles empty or blank input', () => {
    expect(splitIntoSentences('')).toEqual([]);
    expect(splitIntoSentences('   ')).toEqual([]);
  });

  it('does not split on abbreviation periods', () => {
    expect(splitIntoSentences('Dr. Smith is here. He left.')).toEqual([
      'Dr. Smith is here.',
      'He left.',
    ]);
  });

  it('does not split on single-letter initials', () => {
    expect(splitIntoSentences('J. R. Tolkien wrote it. True.')).toEqual([
      'J. R. Tolkien wrote it.',
      'True.',
    ]);
  });

  it('does not split on decimal or version numbers', () => {
    expect(splitIntoSentences('Pi is 3.14159. Roughly.')).toEqual([
      'Pi is 3.14159.',
      'Roughly.',
    ]);
  });

  it('splits CJK sentences without spaces', () => {
    expect(splitIntoSentences('你好。再见！')).toEqual(['你好。', '再见！']);
  });
});
