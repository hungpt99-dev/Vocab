import { describe, expect, it } from 'vitest';
import {
  buildExplainSystemPrompt,
  substituteTemplate,
} from './explain-word.prompt';

describe('explain prompt template', () => {
  it('uses the built-in prompt when no template is given', () => {
    expect(buildExplainSystemPrompt('word')).toContain('bilingual lexicographer');
    expect(buildExplainSystemPrompt('word', '')).toContain('bilingual lexicographer');
  });

  it('substitutes tokens in a user template', () => {
    const tpl = 'Explain {{word}} in {{language}} (kind={{kind}}). Context: {{context}}';
    const out = substituteTemplate(tpl, 'sentence', {
      language: 'Vietnamese',
      word: 'serendipity',
      context: 'the page text',
    });
    expect(out).toBe('Explain serendipity in Vietnamese (kind=sentence). Context: the page text');
  });

  it('falls back to English and empty word when vars omitted', () => {
    const out = substituteTemplate('Lang={{language}} Word={{word}}', 'word');
    expect(out).toBe('Lang=English Word=');
  });

  it('defaults to English for the word prompt language', () => {
    expect(buildExplainSystemPrompt('word')).toContain('"translation":string');
    expect(buildExplainSystemPrompt('word')).toContain('"etymology":string');
  });

  it('has a dedicated prompt for the examples and native kinds', () => {
    expect(buildExplainSystemPrompt('examples')).toContain('5-6 natural, varied sentences');
    expect(buildExplainSystemPrompt('native')).toContain('in their own language');
  });

  it('has a dedicated prompt for the related-vocabulary kind', () => {
    expect(buildExplainSystemPrompt('related')).toContain('relatedWords lists up to 8');
  });
});
