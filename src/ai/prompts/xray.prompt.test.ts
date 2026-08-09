import { describe, expect, it } from 'vitest';
import { XRAY_SYSTEM_PROMPT, buildXRayUserPrompt } from './xray.prompt';
import { buildExplainSystemPrompt, buildExplainWordUserPrompt } from './explain-word.prompt';

describe('X-Ray Reading prompts', () => {
  it('never names a specific source language in the system prompt', () => {
    expect(XRAY_SYSTEM_PROMPT).toMatch(/ANY language/);
    expect(XRAY_SYSTEM_PROMPT).toMatch(/Never assume it is English, Vietnamese/);
  });

  it('forbids grammar-teacher behaviour', () => {
    expect(XRAY_SYSTEM_PROMPT).toMatch(/Do not explain every word/);
    expect(XRAY_SYSTEM_PROMPT).toMatch(/Do not force every text into subject-verb-object/);
    expect(XRAY_SYSTEM_PROMPT).toMatch(/comprehension bottleneck/);
  });

  it('offers several representations rather than one fixed structure', () => {
    for (const shape of ['actor → action → result', 'cause → effect', 'condition → consequence']) {
      expect(XRAY_SYSTEM_PROMPT).toContain(shape);
    }
  });

  it('is registered as the xray kind system prompt', () => {
    expect(buildExplainSystemPrompt('xray')).toBe(XRAY_SYSTEM_PROMPT);
  });

  it('is not overridden by the user word-explanation template', () => {
    expect(buildExplainSystemPrompt('xray', 'my custom {{word}} template')).toBe(
      XRAY_SYSTEM_PROMPT,
    );
    // Other kinds still honour the template.
    expect(buildExplainSystemPrompt('word', 'my custom template')).toBe('my custom template');
  });

  it('asks the model to detect the language instead of declaring one', () => {
    const prompt = buildXRayUserPrompt({ word: 'Con mèo đang ngủ trên ghế.', language: 'English' });
    expect(prompt).toContain('Con mèo đang ngủ trên ghế.');
    expect(prompt).toMatch(/Detect the language of the text yourself/);
    expect(prompt).toMatch(/write your explanations in English/);
  });

  it('routes the xray kind through the shared user-prompt builder', () => {
    const built = buildExplainWordUserPrompt({ word: 'Hello there', kind: 'xray', language: 'Vietnamese' });
    expect(built).toBe(buildXRayUserPrompt({ word: 'Hello there', kind: 'xray', language: 'Vietnamese' }));
    expect(built).toMatch(/write your explanations in Vietnamese/);
  });

  it('analyses the whole sentence instead of checking it', () => {
    expect(XRAY_SYSTEM_PROMPT).toMatch(/analyse the selected text as a whole/i);
    expect(XRAY_SYSTEM_PROMPT).toMatch(/NOT a grammar checker/);
    expect(XRAY_SYSTEM_PROMPT).toMatch(/never look for mistakes/);
  });

  it('asks for every anatomy section', () => {
    for (const field of ['structure —', 'grammar —', 'why —', 'vocabulary —', 'simplerVersion —']) {
      expect(XRAY_SYSTEM_PROMPT).toContain(field);
    }
    expect(XRAY_SYSTEM_PROMPT).toMatch(/difficulty\.cefr/);
  });

  it('treats CEFR as a language-neutral difficulty scale', () => {
    expect(XRAY_SYSTEM_PROMPT).toMatch(/does NOT mean the text is English/);
    expect(XRAY_SYSTEM_PROMPT).toMatch(/Apply it to\s+whatever language the text is in/);
  });

  it('does not impose English grammar categories on other languages', () => {
    expect(XRAY_SYSTEM_PROMPT).toMatch(/categories that genuinely fit the language you detected/);
    expect(XRAY_SYSTEM_PROMPT).toMatch(/topic and comment/);
    expect(XRAY_SYSTEM_PROMPT).toMatch(/particles, classifiers, cases/);
    expect(XRAY_SYSTEM_PROMPT).toMatch(
      /subject\/verb\/object ONLY when those categories really describe the language/,
    );
    expect(XRAY_SYSTEM_PROMPT).toMatch(/never treat English grammar as the default/);
  });

  it('keeps quotes, terms and the simpler version in the original language', () => {
    expect(XRAY_SYSTEM_PROMPT).toMatch(/IN THE ORIGINAL LANGUAGE/);
    const prompt = buildXRayUserPrompt({ word: '彼が昨日出した報告書が懸念を呼んでいる。', language: 'Vietnamese' });
    expect(prompt).toMatch(/do not analyse it as if it were English/);
    expect(prompt).toMatch(/vocabulary terms and the simpler version in the original/);
    expect(prompt).toMatch(/write your explanations in Vietnamese/);
    expect(prompt).toMatch(/Do not check it for mistakes/);
  });

  it('builds the same prompt shape for any language it is given', () => {
    const samples = [
      'The report has raised concerns.',
      'Bản báo cáo đã gây lo ngại.',
      '報告書が懸念を呼んでいる。',
      'أثار التقرير مخاوف.',
      'Доклад вызвал обеспокоенность.',
    ];
    for (const sample of samples) {
      const prompt = buildXRayUserPrompt({ word: sample, language: 'English' });
      expect(prompt).toContain(sample);
      expect(prompt).toMatch(/Detect the language of the text yourself/);
      // The prompt must never assert what language the sample is.
      expect(prompt).not.toMatch(/The source language is/);
    }
  });

  it('includes page context when present', () => {
    const prompt = buildXRayUserPrompt({
      word: 'The report has raised concerns.',
      context: 'The report that the committee released yesterday has raised concerns.',
      pageTitle: 'Committee news',
      sourceUrl: 'https://example.com/a',
    });
    expect(prompt).toContain('Committee news');
    expect(prompt).toContain('https://example.com/a');
  });
});
