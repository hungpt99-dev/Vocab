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
