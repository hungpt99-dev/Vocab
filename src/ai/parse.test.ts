import { describe, expect, it } from 'vitest';
import { extractJsonObject, extractTranslation, toExplanation } from './parse';
import { AiError } from './types';

const valid = JSON.stringify({
  meaning: 'A fortunate accident.',
  simpleExplanation: 'Finding something good by luck.',
  translation: 'Serendipidad',
  examples: ['It was serendipity.', 'Pure serendipity!'],
  synonyms: ['luck', 'chance'],
  antonyms: ['misfortune'],
  relatedWords: ['fortune', 'coincidence'],
  pronunciation: '/ˌsɛrənˈdɪpɪti/',
  collocations: ['sheer serendipity'],
  grammar: 'Noun, uncountable.',
});

describe('extractJsonObject', () => {
  it('parses bare JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses fenced JSON', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('parses JSON surrounded by prose', () => {
    expect(extractJsonObject('Sure! {"a":1} Hope that helps.')).toEqual({ a: 1 });
  });

  it('throws when no object is present', () => {
    expect(() => extractJsonObject('no json here')).toThrow(AiError);
  });

  it('throws on malformed JSON', () => {
    expect(() => extractJsonObject('{"a":}')).toThrow(/not valid JSON/);
  });
});

describe('toExplanation', () => {
  const meta = { provider: 'openai', model: 'gpt-4o-mini' };

  it('maps a complete response', () => {
    const explanation = toExplanation(valid, meta);
    expect(explanation.meaning).toBe('A fortunate accident.');
    expect(explanation.translation).toBe('Serendipidad');
    expect(explanation.antonyms).toEqual(['misfortune']);
    expect(explanation.relatedWords).toEqual(['fortune', 'coincidence']);
    expect(explanation.grammar).toBe('Noun, uncountable.');
    expect(explanation.examples).toHaveLength(2);
    expect(explanation.synonyms).toEqual(['luck', 'chance']);
    expect(explanation.provider).toBe('openai');
    expect(explanation.generatedAt).toBeGreaterThan(0);
  });

  it('defaults the optional enrichment fields to empty when absent', () => {
    const explanation = toExplanation('{"meaning":"m"}', meta);
    expect(explanation.translation).toBe('');
    expect(explanation.antonyms).toEqual([]);
    expect(explanation.relatedWords).toEqual([]);
    expect(explanation.grammar).toBe('');
    expect(explanation.partOfSpeech).toBe('');
    expect(explanation.usage).toBe('');
    expect(explanation.summary).toBe('');
    expect(explanation.difficultVocabulary).toEqual([]);
  });

  it('coerces the unit-specific fields', () => {
    const explanation = toExplanation(
      '{"meaning":"m","partOfSpeech":"noun","usage":"idiom","summary":"gist","difficultVocabulary":"gloss: x"}',
      meta,
    );
    expect(explanation.partOfSpeech).toBe('noun');
    expect(explanation.usage).toBe('idiom');
    expect(explanation.summary).toBe('gist');
    expect(explanation.difficultVocabulary).toEqual(['gloss: x']);
  });

  it('falls back simpleExplanation to meaning', () => {
    expect(toExplanation('{"meaning":"m"}', meta).simpleExplanation).toBe('m');
  });

  it('coerces scalar fields into arrays', () => {
    const explanation = toExplanation('{"meaning":"m","synonyms":"one"}', meta);
    expect(explanation.synonyms).toEqual(['one']);
  });

  it('drops non-string array members', () => {
    const explanation = toExplanation('{"meaning":"m","examples":["a",null,3,"b"]}', meta);
    expect(explanation.examples).toEqual(['a', 'b']);
  });

  it('rejects a response without a meaning', () => {
    expect(() => toExplanation('{"synonyms":["a"]}', meta)).toThrow(/missing a meaning/);
  });
});

describe('extractTranslation', () => {
  it('returns plain text unchanged', () => {
    expect(extractTranslation('Bonjour le monde.')).toBe('Bonjour le monde.');
  });

  it('strips markdown fences', () => {
    expect(extractTranslation('```\nBonjour le monde.\n```')).toBe('Bonjour le monde.');
  });

  it('strips fenced blocks with a language hint', () => {
    expect(extractTranslation('```text\nBonjour le monde.\n```')).toBe('Bonjour le monde.');
  });

  it('keeps placeholder markers intact', () => {
    expect(extractTranslation('Bonjour [[0]]monde [[1]]!')).toBe('Bonjour [[0]]monde [[1]]!');
  });

  it('rejects an empty response', () => {
    expect(() => extractTranslation('   ')).toThrow(AiError);
  });
});
