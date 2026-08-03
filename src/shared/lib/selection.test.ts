import { describe, expect, it } from 'vitest';
import { detectSelection } from './selection';

describe('detectSelection', () => {
  it('classifies a single token as a word', () => {
    expect(detectSelection('serendipity').unit).toBe('word');
  });

  it('classifies a multi-word span without sentence end as a phrase', () => {
    expect(detectSelection('a piece of cake').unit).toBe('phrase');
  });

  it('classifies a single sentence as a sentence', () => {
    expect(detectSelection('Serendipity struck me today.').unit).toBe('sentence');
  });

  it('classifies two sentences as a paragraph', () => {
    expect(detectSelection('One sentence. Then another one.').unit).toBe('paragraph');
  });

  it('classifies an empty selection as a word', () => {
    expect(detectSelection('   ').unit).toBe('word');
  });

  it('detects the source language alongside the unit', () => {
    expect(detectSelection('serendipity')).toEqual({ unit: 'word', language: 'English' });
    expect(detectSelection('你好世界')).toEqual({ unit: 'word', language: 'Chinese' });
  });

  it('returns an empty language for text with no recognisable script', () => {
    expect(detectSelection('1 2 3').language).toBe('');
  });
});
