import { describe, expect, it } from 'vitest';
import {
  EXPLAIN_WORD_SYSTEM_PROMPT,
  buildExplainSystemPrompt,
  buildExplainWordUserPrompt,
} from './explain-word.prompt';

describe('buildExplainSystemPrompt', () => {
  it('returns a distinct prompt for every kind', () => {
    const kinds = ['word', 'sentence', 'grammar', 'vocabulary', 'simplify', 'summarize'] as const;
    const prompts = kinds.map((kind) => buildExplainSystemPrompt(kind));
    expect(new Set(prompts).size).toBe(kinds.length);
  });

  it('keeps the word prompt stable for compatibility', () => {
    expect(buildExplainSystemPrompt('word')).toBe(EXPLAIN_WORD_SYSTEM_PROMPT);
  });

  it('defaults to the word prompt when no kind is given', () => {
    expect(buildExplainSystemPrompt()).toBe(EXPLAIN_WORD_SYSTEM_PROMPT);
  });

  it('instructs every kind to answer with the same JSON shape', () => {
    const prompt = buildExplainSystemPrompt('simplify');
    expect(prompt).toContain('"meaning":string');
    expect(prompt).toContain('"grammar":string');
  });
});

describe('buildExplainWordUserPrompt', () => {
  it('labels the target as a word or phrase for the word kind', () => {
    const prompt = buildExplainWordUserPrompt({ word: 'cake', language: 'Spanish' });
    expect(prompt).toContain('Word or phrase: "cake"');
    expect(prompt).toContain('Explain it in Spanish.');
  });

  it('labels the target as text for sentence-level kinds', () => {
    const prompt = buildExplainWordUserPrompt({
      word: 'The cat sat down.',
      kind: 'summarize',
      language: 'French',
    });
    expect(prompt).toContain('Text: "The cat sat down."');
    expect(prompt).toContain('Use French for the explanation.');
  });

  it('includes the surrounding context when present', () => {
    const prompt = buildExplainWordUserPrompt({
      word: 'cat',
      context: 'The cat sat on the mat.',
      kind: 'grammar',
    });
    expect(prompt).toContain('It appeared in this context: "The cat sat on the mat."');
  });
});
