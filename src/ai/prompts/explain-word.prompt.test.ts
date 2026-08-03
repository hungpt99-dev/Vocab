import { describe, expect, it } from 'vitest';
import { buildExplainWordUserPrompt } from './explain-word.prompt';

describe('buildExplainWordUserPrompt', () => {
  it('defaults to the word variant and English', () => {
    const prompt = buildExplainWordUserPrompt({ word: 'serendipity' });
    expect(prompt).toContain('Word or phrase: "serendipity"');
    expect(prompt).toContain('Explain this word');
    expect(prompt).toContain('Explain it in English. Respond with JSON only.');
  });

  it('selects the phrase variant', () => {
    const prompt = buildExplainWordUserPrompt({ word: 'a piece of cake', unit: 'phrase' });
    expect(prompt).toContain('Explain this phrase or idiom');
  });

  it('selects the sentence variant', () => {
    const prompt = buildExplainWordUserPrompt({ word: 'Serendipity struck me today.', unit: 'sentence' });
    expect(prompt).toContain('Explain the meaning and grammar of this sentence');
  });

  it('selects the paragraph variant', () => {
    const prompt = buildExplainWordUserPrompt({ word: 'One. Two.', unit: 'paragraph' });
    expect(prompt).toContain('Summarise and explain this paragraph');
  });

  it('includes the context sentence when provided', () => {
    const prompt = buildExplainWordUserPrompt({ word: 'cake', context: 'I love cake.' });
    expect(prompt).toContain('It appeared in this sentence: "I love cake."');
  });

  it('names the source language when it differs from the target', () => {
    const prompt = buildExplainWordUserPrompt({
      word: '你好',
      unit: 'word',
      sourceLanguage: 'Chinese',
    });
    expect(prompt).toContain('The selected text is in Chinese.');
  });

  it('omits the source-language line when it matches the target', () => {
    const prompt = buildExplainWordUserPrompt({ word: 'cake', sourceLanguage: 'English' });
    expect(prompt).not.toContain('The selected text is in');
  });

  it('honours an explicit target language', () => {
    const prompt = buildExplainWordUserPrompt({ word: 'cake', language: 'Vietnamese' });
    expect(prompt).toContain('Explain it in Vietnamese.');
  });
});
