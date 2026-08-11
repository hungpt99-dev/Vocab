import { describe, expect, it } from 'vitest';
import { parseRadarAnalysis, makeTextContains } from './validate';

const PAGE = 'The API should be idempotent. The system can gracefully degrade under heavy load. We must consider the trade-off between consistency and latency.';

describe('makeTextContains', () => {
  it('matches case-insensitively and tolerates whitespace', () => {
    const contains = makeTextContains('The API is idempotent now');
    expect(contains('idempotent')).toBe(true);
    expect(contains('IDEMPOTENT')).toBe(true);
    expect(contains('not present')).toBe(false);
  });
});

describe('parseRadarAnalysis', () => {
  it('parses valid candidates and keeps only those present in the text', () => {
    const json = JSON.stringify({
      candidates: [
        { text: 'idempotent', type: 'word', score: 98, reason: 'Relevant to API design', context: 'The API should be idempotent.' },
        { text: 'gracefully degrade', type: 'phrase', score: 96, reason: 'System resilience' },
        { text: 'blockchain', type: 'word', score: 90, reason: 'Not on page' },
      ],
    });
    const candidates = parseRadarAnalysis(json, PAGE);
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('idempotent');
    expect(texts).toContain('gracefully degrade');
    expect(texts).not.toContain('blockchain');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseRadarAnalysis('not json{', PAGE)).toThrow();
  });

  it('throws when candidates array is missing', () => {
    expect(() => parseRadarAnalysis(JSON.stringify({ foo: 1 }), PAGE)).toThrow();
  });

  it('rejects candidates with missing text', () => {
    const json = JSON.stringify({ candidates: [{ score: 90, reason: 'x' }] });
    expect(parseRadarAnalysis(json, PAGE)).toEqual([]);
  });

  it('rejects candidates with out-of-range scores', () => {
    const json = JSON.stringify({
      candidates: [
        { text: 'idempotent', type: 'word', score: 250, reason: 'too high' },
        { text: 'idempotent', type: 'word', score: -5, reason: 'too low' },
      ],
    });
    const result = parseRadarAnalysis(json, PAGE);
    // Out-of-range scores are clamped into 0..100, so they survive validation.
    expect(result).toHaveLength(2);
    expect(result[0]!.score).toBe(100);
    expect(result[1]!.score).toBe(0);
  });

  it('tolerates wrapping quotes and leading articles on candidate text', () => {
    const page = 'The system can gracefully degrade under heavy load.';
    const json = JSON.stringify({
      candidates: [
        { text: '"gracefully degrade"', type: 'phrase', score: 96, reason: 'resilience' },
        { text: 'the heavy load', type: 'phrase', score: 80, reason: 'context' },
      ],
    });
    const result = parseRadarAnalysis(json, page);
    // Both candidates are accepted (quotes stripped for matching; a leading
    // article is tolerated when matching but kept in the stored text).
    expect(result).toHaveLength(2);
    const byText = new Map(result.map((c) => [c.text, c]));
    expect(byText.has('gracefully degrade')).toBe(true);
    expect(byText.has('the heavy load')).toBe(true);
  });

  it('drops candidates whose text is not in the source', () => {
    const json = JSON.stringify({
      candidates: [{ text: 'nonexistent phrase here', type: 'phrase', score: 80, reason: 'x' }],
    });
    expect(parseRadarAnalysis(json, PAGE)).toEqual([]);
  });

  it('defaults type to word and coerces non-string reason/context', () => {
    const json = JSON.stringify({
      candidates: [{ text: 'idempotent', score: 88 }],
    });
    const result = parseRadarAnalysis(json, PAGE);
    const c = result[0]!;
    expect(c.type).toBe('word');
    expect(c.reason).toBe('');
    expect(c.context).toBeUndefined();
  });
});
