import { describe, expect, it } from 'vitest';
import {
  buildExplainSystemPrompt,
  buildExplainUserPrompt,
  EXPLAIN_PHRASE_SYSTEM_PROMPT,
  EXPLAIN_SENTENCE_SYSTEM_PROMPT,
} from './explain-selection.prompt';
import { EXPLAIN_WORD_SYSTEM_PROMPT } from './explain-word.prompt';
import type { ExplainRequest } from '@/shared/types/explain';

const fullRequest: ExplainRequest = {
  word: 'a piece of cake',
  unit: 'phrase',
  context: 'Finishing the report on time was a piece of cake.',
  sourceUrl: 'https://example.com/article',
  sourceTitle: 'Example article',
  sourceLanguage: 'English',
  language: 'French',
};

describe('buildExplainSystemPrompt', () => {
  it('selects the word prompt by default', () => {
    expect(buildExplainSystemPrompt(undefined)).toBe(EXPLAIN_WORD_SYSTEM_PROMPT);
    expect(buildExplainSystemPrompt('word')).toBe(EXPLAIN_WORD_SYSTEM_PROMPT);
  });

  it('selects the phrase and sentence prompts', () => {
    expect(buildExplainSystemPrompt('phrase')).toBe(EXPLAIN_PHRASE_SYSTEM_PROMPT);
    expect(buildExplainSystemPrompt('sentence')).toBe(EXPLAIN_SENTENCE_SYSTEM_PROMPT);
  });

  it('requests the word fields from the spec', () => {
    expect(EXPLAIN_WORD_SYSTEM_PROMPT).toContain('partOfSpeech');
    expect(EXPLAIN_WORD_SYSTEM_PROMPT).toContain('pronunciation');
    expect(EXPLAIN_WORD_SYSTEM_PROMPT).toContain('collocations');
  });

  it('requests the phrase fields from the spec', () => {
    expect(EXPLAIN_PHRASE_SYSTEM_PROMPT).toContain('usage');
    expect(EXPLAIN_PHRASE_SYSTEM_PROMPT).toContain('grammar');
  });

  it('requests the sentence fields from the spec', () => {
    expect(EXPLAIN_SENTENCE_SYSTEM_PROMPT).toContain('summary');
    expect(EXPLAIN_SENTENCE_SYSTEM_PROMPT).toContain('difficultVocabulary');
  });
});

describe('buildExplainUserPrompt', () => {
  it('sends the surrounding context, page, languages and target language', () => {
    const prompt = buildExplainUserPrompt(fullRequest);
    expect(prompt).toContain('Phrase: "a piece of cake"');
    expect(prompt).toContain('It appeared in this context: "Finishing the report on time was a piece of cake."');
    expect(prompt).toContain('Page title: "Example article"');
    expect(prompt).toContain('Source URL: https://example.com/article');
    expect(prompt).toContain('The source language is English.');
    expect(prompt).toContain('Explain this phrase in French.');
  });

  it('defaults the unit to a word prompt', () => {
    const prompt = buildExplainUserPrompt({ word: 'serendipity' });
    expect(prompt).toContain('Word or phrase: "serendipity"');
    expect(prompt).toContain('Explain it in English.');
  });

  it('labels the selection as a sentence', () => {
    const prompt = buildExplainUserPrompt({ ...fullRequest, unit: 'sentence' });
    expect(prompt).toContain('Sentence: "a piece of cake"');
    expect(prompt).toContain('Explain this sentence in French.');
  });
});
