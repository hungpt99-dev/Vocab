import { describe, expect, it } from 'vitest';
import { toXRayResult, xrayFromObject } from './parse-xray';
import { toExplanation } from './parse';

const FULL = JSON.stringify({
  detectedLanguage: 'English',
  originalText: 'The report that the committee released yesterday has raised concerns.',
  meaning: 'The report has caused concern.',
  core: {
    representation: 'The report → has raised → concerns',
    simpleMeaning: 'The report has caused concern.',
  },
  complexity: [
    {
      text: 'that the committee released yesterday',
      explanation: 'Extra information about the report.',
      relatesTo: 'the report',
    },
  ],
  relationships: [{ from: 'the committee', relation: 'released', to: 'the report' }],
  fullExplanation:
    'The committee released a report yesterday, and that report has now caused concern.',
});

describe('toXRayResult', () => {
  it('parses a complete X-Ray payload', () => {
    const result = toXRayResult(FULL, 'fallback');
    expect(result).not.toBeNull();
    expect(result?.detectedLanguage).toBe('English');
    expect(result?.core.representation).toBe('The report → has raised → concerns');
    expect(result?.complexity).toHaveLength(1);
    expect(result?.complexity[0]?.relatesTo).toBe('the report');
    expect(result?.relationships[0]?.relation).toBe('released');
    expect(result?.fullExplanation).toMatch(/caused concern/);
  });

  it('works for a non-English, non-Vietnamese text without any language branch', () => {
    const raw = JSON.stringify({
      detectedLanguage: 'Japanese',
      originalText: '委員会が昨日公表した報告書が懸念を呼んでいる。',
      core: { representation: '報告書 → 呼んでいる → 懸念', simpleMeaning: '報告書が懸念を招いた。' },
      complexity: [{ text: '委員会が昨日公表した', explanation: '報告書を説明する修飾節。' }],
      relationships: [],
      fullExplanation: '委員会が昨日報告書を公表し、その報告書が懸念を招いている。',
    });
    const result = toXRayResult(raw, '');
    expect(result?.detectedLanguage).toBe('Japanese');
    expect(result?.core.simpleMeaning).toBe('報告書が懸念を招いた。');
  });

  it('tolerates a flattened core and missing arrays', () => {
    const result = toXRayResult(
      '{"representation":"A → B","simpleMeaning":"A causes B"}',
      'original',
    );
    expect(result?.core.representation).toBe('A → B');
    expect(result?.complexity).toEqual([]);
    expect(result?.relationships).toEqual([]);
    // fullExplanation falls back to the simple meaning.
    expect(result?.fullExplanation).toBe('A causes B');
    expect(result?.originalText).toBe('original');
  });

  it('drops empty complexity layers and incomplete relationships', () => {
    const result = xrayFromObject(
      {
        core: { representation: 'A → B', simpleMeaning: 'x' },
        complexity: [{ text: '', explanation: '' }, { text: 'hard bit', explanation: 'why' }, 'junk'],
        relationships: [{ from: 'a', to: '' }, { from: 'a', relation: 'r', to: 'b' }],
      },
      'orig',
    );
    expect(result?.complexity).toEqual([{ text: 'hard bit', explanation: 'why' }]);
    expect(result?.relationships).toEqual([{ from: 'a', relation: 'r', to: 'b' }]);
  });

  it('returns null for a response with no X-Ray content', () => {
    expect(toXRayResult('{"meaning":"just a word"}', 'x')).toBeNull();
    expect(toXRayResult('not json at all', 'x')).toBeNull();
  });
});

describe('toExplanation with the xray kind', () => {
  const meta = { provider: 'openai', model: 'gpt-4o-mini' };

  it('attaches the structured X-Ray result', () => {
    const explanation = toExplanation(FULL, { ...meta, kind: 'xray', text: 'orig' });
    expect(explanation.xray?.core.representation).toBe('The report → has raised → concerns');
    expect(explanation.meaning).toBe('The report has caused concern.');
  });

  it('falls back to core.simpleMeaning when meaning is absent', () => {
    const raw = '{"core":{"representation":"A → B","simpleMeaning":"A causes B"}}';
    const explanation = toExplanation(raw, { ...meta, kind: 'xray', text: 'orig' });
    expect(explanation.meaning).toBe('A causes B');
    expect(explanation.xray?.originalText).toBe('orig');
  });

  it('does not attach an xray payload for other kinds', () => {
    const explanation = toExplanation(FULL, { ...meta, kind: 'word' });
    expect(explanation.xray).toBeUndefined();
  });
});
