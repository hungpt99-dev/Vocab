import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { toLanguageCode } from './language-codes';
import { googleTranslate } from './google-translate';

describe('toLanguageCode', () => {
  it('maps known display names to ISO codes', () => {
    expect(toLanguageCode('Vietnamese')).toBe('vi');
    expect(toLanguageCode('English')).toBe('en');
    expect(toLanguageCode('Chinese')).toBe('zh-CN');
  });

  it('passes through an existing code', () => {
    expect(toLanguageCode('vi')).toBe('vi');
    expect(toLanguageCode('en-US')).toBe('en-US');
  });

  it('falls back to en for unknown names', () => {
    expect(toLanguageCode('Klingon')).toBe('en');
    expect(toLanguageCode('   ')).toBe('en');
  });
});

describe('googleTranslate (keyless fallback)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = new URL(url);
        const q = u.searchParams.get('q') ?? '';
        const tl = u.searchParams.get('tl') ?? 'en';
        // Emulate the gtx shape: [[[translated, source, ...]]]
        const body = JSON.stringify([[[`[${tl}]${q}`]]]);
        return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('translates paragraphs using the ISO code, not the display name', async () => {
    const out = await googleTranslate.translate(['Hello'], 'Vietnamese');
    expect(out[0]).toBe('[vi]Hello');
  });

  it('align returns a faithful translation plus one single-word gloss per token', async () => {
    const out = await googleTranslate.align([{ id: '1', text: 'Hello world' }], 'Vietnamese');
    expect(out[0]!.translation).toBe('[vi]Hello world');
    expect(out[0]!.pairs).toHaveLength(2);
    expect(out[0]!.pairs[0]).toEqual({ source: 'Hello', target: '[vi]Hello' });
    expect(out[0]!.pairs[1]).toEqual({ source: 'world', target: '[vi]world' });
  });

  it('returns the source text unchanged when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    const out = await googleTranslate.translate(['Hello'], 'Vietnamese');
    expect(out[0]).toBe('Hello');
  });
});
