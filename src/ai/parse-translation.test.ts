import { describe, expect, it } from 'vitest';
import { parseTranslations, parseWordAlignments } from './parse-translation';

describe('parseTranslations', () => {
  it('parses a clean translations array', () => {
    expect(parseTranslations('{"translations":["Hola","Mundo"]}', 2)).toEqual(['Hola', 'Mundo']);
  });

  it('tolerates a fenced JSON response', () => {
    const raw = '```json\n{"translations":["Hola","Mundo"]}\n```';
    expect(parseTranslations(raw, 2)).toEqual(['Hola', 'Mundo']);
  });

  it('collapses whitespace in each translation', () => {
    expect(parseTranslations('{"translations":["  Hola   mundo  "]}', 1)).toEqual(['Hola mundo']);
  });

  it('rejects a response without a translations array', () => {
    expect(() => parseTranslations('{"meaning":"x"}', 1)).toThrow(/translations array/);
  });

  it('rejects a count mismatch so columns cannot misalign', () => {
    expect(() => parseTranslations('{"translations":["Hola"]}', 2)).toThrow(/returned 1 translations/);
  });
});

describe('parseWordAlignments', () => {
  it('reads the per-paragraph translation and pairs (correct word order)', () => {
    const raw = JSON.stringify({
      paragraphs: [
        {
          translation: 'Tên tôi là Hưng',
          pairs: [
            { source: 'My', target: 'Tên' },
            { source: 'name', target: 'tôi' },
            { source: 'is', target: 'là' },
            { source: 'Hung', target: 'Hưng' },
          ],
        },
      ],
    });
    expect(parseWordAlignments(raw, 1)).toEqual([
      {
        translation: 'Tên tôi là Hưng',
        pairs: [
          { source: 'My', target: 'Tên' },
          { source: 'name', target: 'tôi' },
          { source: 'is', target: 'là' },
          { source: 'Hung', target: 'Hưng' },
        ],
      },
    ]);
  });

  it('falls back to joined pair targets when no translation field', () => {
    const raw = JSON.stringify({
      paragraphs: [{ pairs: [{ source: 'Hung', target: 'Hưng' }] }],
    });
    expect(parseWordAlignments(raw, 1)).toEqual([
      { translation: 'Hưng', pairs: [{ source: 'Hung', target: 'Hưng' }] },
    ]);
  });

  it('still accepts the legacy flat pairs shape and round-robins across paragraphs', () => {
    const raw = JSON.stringify({
      pairs: [
        { source: 'Node.js', target: 'Node.js' },
        { source: 'runs', target: 'chạy' },
      ],
    });
    const out = parseWordAlignments(raw, 2);
    expect(out).toHaveLength(2);
    expect(out[0]!.translation).toBe('Node.js chạy');
    expect(out[1]!.translation).toBe('Node.js chạy');
  });

  it('returns empty results for malformed input', () => {
    const out = parseWordAlignments('not json', 2);
    expect(out).toEqual([
      { translation: '', pairs: [] },
      { translation: '', pairs: [] },
    ]);
  });
});
