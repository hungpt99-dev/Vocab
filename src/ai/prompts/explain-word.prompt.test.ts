import { describe, expect, it } from 'vitest';
import { EXPLAIN_WORD_SYSTEM_PROMPT, buildExplainWordUserPrompt } from './explain-word.prompt';

describe('buildExplainWordUserPrompt', () => {
  it('includes only the word when no context is given', () => {
    const prompt = buildExplainWordUserPrompt({ word: 'serendipity' });
    expect(prompt).toBe(
      ['Word or phrase: "serendipity"', 'Explain it in English. Respond with JSON only.'].join('\n'),
    );
  });

  it('includes the sentence, page title and preceding text when provided', () => {
    const prompt = buildExplainWordUserPrompt({
      word: 'serendipity',
      context: 'Pure serendipity struck.',
      pageTitle: 'How We Built the API',
      precedingText: 'Reviewing the schema,',
    });

    expect(prompt).toContain('It appeared in this sentence: "Pure serendipity struck."');
    expect(prompt).toContain('Page title: "How We Built the API"');
    expect(prompt).toContain('Preceding text on the page: "Reviewing the schema,"');
    expect(prompt).toContain('Explain it in English. Respond with JSON only.');
  });

  it('honours the requested language', () => {
    const prompt = buildExplainWordUserPrompt({ word: 'serendipity', language: 'Vietnamese' });
    expect(prompt).toContain('Explain it in Vietnamese.');
  });
});

describe('EXPLAIN_WORD_SYSTEM_PROMPT', () => {
  it('demands names, brands, technical terms and code stay verbatim', () => {
    expect(EXPLAIN_WORD_SYSTEM_PROMPT).toMatch(
      /Preserve proper nouns, brand names, technical terms and code snippets verbatim/,
    );
    expect(EXPLAIN_WORD_SYSTEM_PROMPT).toMatch(/never translate them/);
  });
});
