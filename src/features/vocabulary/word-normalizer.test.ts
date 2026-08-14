import { describe, expect, it } from 'vitest';
import { DefaultWordNormalizer } from './word-normalizer';

const normalize = new DefaultWordNormalizer();

describe('WordNormalizer (text-level only, language-agnostic)', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalize.normalize(' BOOKS ')).toBe('books');
    expect(normalize.normalize('BOOK')).toBe('book');
    expect(normalize.normalize(' Book ')).toBe('book');
  });

  it('collapses internal whitespace', () => {
    expect(normalize.normalize('  running   fast ')).toBe('running fast');
  });

  it('strips surrounding punctuation but keeps internal punctuation', () => {
    expect(normalize.normalize('"books"')).toBe('books');
    expect(normalize.normalize('(running)')).toBe('running');
    expect(normalize.normalize('"well-known"')).toBe('well-known');
    expect(normalize.normalize('"state-of-the-art"')).toBe('state-of-the-art');
  });

  it('does NOT do linguistic reduction (books stays books)', () => {
    expect(normalize.normalize('books')).toBe('books');
    expect(normalize.normalize('running')).toBe('running');
  });

  it('normalizes Unicode so equivalent forms compare equal', () => {
    expect(normalize.normalize('café')).toBe(normalize.normalize('café'));
    expect(normalize.normalize(' résumé ')).toBe('résumé');
  });

  it('preserves non-Latin scripts (multi-language)', () => {
    expect(normalize.normalize(' 本 ')).toBe('本');
    expect(normalize.normalize('КНИГА')).toBe('книга');
    expect(normalize.normalize('SACH')).toBe('sach');
  });

  it('returns empty string for blank input', () => {
    expect(normalize.normalize('   ')).toBe('');
    expect(normalize.normalize('')).toBe('');
  });
});
