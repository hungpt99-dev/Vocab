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

describe('whole-sentence anatomy (VOC-122)', () => {
  const anatomy = {
    core: { representation: 'A → B', simpleMeaning: 'A causes B' },
    structure: 'One main clause with a relative clause attached to the subject.',
    grammar: 'Relative clause; present perfect for a result that still stands.',
    meaning: 'The publication has produced worry.',
    why: 'Front-loading the report makes it the topic rather than the committee.',
    vocabulary: [
      { term: 'raise concerns', note: 'to cause worry', kind: 'collocation' },
      { term: 'release', note: 'to publish officially' },
    ],
    difficulty: { cefr: 'B2', reason: 'Embedded clause plus abstract nouns.' },
    simplerVersion: 'The committee published a report yesterday. People are worried.',
  };

  it('parses every anatomy field', () => {
    const r = toXRayResult(JSON.stringify(anatomy), 'orig');
    expect(r?.structure).toContain('relative clause');
    expect(r?.grammar).toContain('present perfect');
    expect(r?.meaning).toBe('The publication has produced worry.');
    expect(r?.why).toContain('topic');
    expect(r?.vocabulary).toHaveLength(2);
    expect(r?.vocabulary?.[0]).toEqual({
      term: 'raise concerns',
      note: 'to cause worry',
      kind: 'collocation',
    });
    // kind is optional and omitted rather than blank.
    expect(r?.vocabulary?.[1]).toEqual({ term: 'release', note: 'to publish officially' });
    expect(r?.difficulty).toEqual({ cefr: 'B2', reason: 'Embedded clause plus abstract nouns.' });
    expect(r?.simplerVersion).toContain('published a report');
  });

  it('omits sections the model did not provide', () => {
    const r = toXRayResult(JSON.stringify({ core: { representation: 'A → B' } }), 'orig');
    expect(r).not.toBeNull();
    expect(r?.structure).toBeUndefined();
    expect(r?.grammar).toBeUndefined();
    expect(r?.why).toBeUndefined();
    expect(r?.vocabulary).toBeUndefined();
    expect(r?.difficulty).toBeUndefined();
    expect(r?.simplerVersion).toBeUndefined();
  });

  it('recognises an X-Ray made only of anatomy fields', () => {
    const r = toXRayResult(JSON.stringify({ structure: 'Two coordinated clauses.' }), 'orig');
    expect(r?.structure).toBe('Two coordinated clauses.');
  });

  it('normalises loosely-written CEFR levels', () => {
    for (const [written, expected] of [
      ['b2', 'B2'],
      ['B2 (upper intermediate)', 'B2'],
      ['Level C1', 'C1'],
      ['a1', 'A1'],
    ] as const) {
      const r = toXRayResult(JSON.stringify({ structure: 's', difficulty: { cefr: written } }), 'o');
      expect(r?.difficulty?.cefr).toBe(expected);
    }
  });

  it('drops a difficulty it cannot map to a CEFR level', () => {
    for (const bogus of ['intermediate', 'D9', '', 'hard']) {
      const r = toXRayResult(JSON.stringify({ structure: 's', difficulty: { cefr: bogus } }), 'o');
      expect(r?.difficulty).toBeUndefined();
    }
  });

  it('drops incomplete vocabulary items and caps the list at five', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ term: `t${i}`, note: `n${i}` }));
    const r = toXRayResult(
      JSON.stringify({
        structure: 's',
        vocabulary: [{ term: 'no note' }, { note: 'no term' }, ...many],
      }),
      'o',
    );
    expect(r?.vocabulary).toHaveLength(5);
    expect(r?.vocabulary?.[0]?.term).toBe('t0');
  });

  it('suppresses a simpler version identical to the original text', () => {
    const same = 'Đây là một câu đơn giản.';
    const r = toXRayResult(JSON.stringify({ structure: 's', simplerVersion: same }), same);
    expect(r?.simplerVersion).toBeUndefined();
  });

  it('does not duplicate the core meaning as the natural meaning', () => {
    const r = toXRayResult(
      JSON.stringify({ core: { simpleMeaning: 'Same text' }, meaning: 'Same text' }),
      'o',
    );
    expect(r?.core.simpleMeaning).toBe('Same text');
    expect(r?.meaning).toBeUndefined();
  });

  it('carries anatomy for languages that are neither English nor Vietnamese', () => {
    // Japanese: topic-comment framing, terms kept in the original script.
    const ja = toXRayResult(
      JSON.stringify({
        detectedLanguage: 'Japanese',
        core: { representation: '報告書 → 呼んでいる → 懸念', simpleMeaning: '報告書が懸念を招いた。' },
        structure: '主題が助詞「が」で示され、連体修飾節が報告書を説明している。',
        grammar: '連体修飾節と継続を表すテイル形。',
        vocabulary: [{ term: '懸念を呼ぶ', note: '心配を引き起こす', kind: '慣用表現' }],
        difficulty: { cefr: 'B2' },
      }),
      '',
    );
    expect(ja?.structure).toContain('連体修飾節');
    expect(ja?.vocabulary?.[0]?.term).toBe('懸念を呼ぶ');
    expect(ja?.difficulty?.cefr).toBe('B2');

    // Arabic: verb-initial ordering, right-to-left script preserved verbatim.
    const ar = toXRayResult(
      JSON.stringify({
        detectedLanguage: 'Arabic',
        core: { representation: 'التقرير → أثار → مخاوف', simpleMeaning: 'التقرير سبب القلق.' },
        structure: 'جملة فعلية تبدأ بالفعل ثم الفاعل.',
        vocabulary: [{ term: 'أثار مخاوف', note: 'سبب القلق', kind: 'تلازم لفظي' }],
        difficulty: { cefr: 'B1' },
      }),
      '',
    );
    expect(ar?.structure).toContain('جملة فعلية');
    expect(ar?.vocabulary?.[0]?.term).toBe('أثار مخاوف');
    expect(ar?.difficulty?.cefr).toBe('B1');
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
