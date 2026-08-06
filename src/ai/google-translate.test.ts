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

  it('align batches a chunk into ~2 requests and returns exact glosses per token', async () => {
    let requestCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        requestCount += 1;
        const u = new URL(url);
        const q = u.searchParams.get('q') ?? '';
        const tl = u.searchParams.get('tl') ?? 'en';
        // Sentence request uses '\n\n'; token request uses '\n'.
        if (q.includes('\n\n')) {
          const translated = q.split('\n\n').map((s) => `[${tl}]${s}`).join('\n\n');
          return new Response(JSON.stringify([[[translated]]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (q.includes('\n')) {
          const translated = q.split('\n').map((t) => `[${tl}]${t}`).join('\n');
          return new Response(JSON.stringify([[[translated]]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify([[[`[${tl}]${q}`]]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    const out = await googleTranslate.align([{ id: '1', text: 'Hello world' }], 'Vietnamese');
    // Two requests: one for the sentence line, one for the joined tokens
    // (which now also includes the "Hello world" two-word phrase).
    expect(requestCount).toBe(2);
    expect(out[0]!.translation).toBe('[vi]Hello world');
    expect(out[0]!.pairs).toHaveLength(3);
    expect(out[0]!.pairs[0]).toEqual({ source: 'Hello', target: '[vi]Hello' });
    expect(out[0]!.pairs[1]).toEqual({ source: 'world', target: '[vi]world' });
    expect(out[0]!.pairs[2]).toEqual({ source: 'Hello world', target: '[vi]Hello world' });
  });

  it('batches many paragraphs into a constant ~2 requests (no per-paragraph explosion)', async () => {
    let requestCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        requestCount += 1;
        const u = new URL(url);
        const q = u.searchParams.get('q') ?? '';
        const tl = u.searchParams.get('tl') ?? 'en';
        if (q.includes('\n\n')) {
          const translated = q.split('\n\n').map((s) => `[${tl}]${s}`).join('\n\n');
          return new Response(JSON.stringify([[[translated]]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (q.includes('\n')) {
          const translated = q.split('\n').map((t) => `[${tl}]${t}`).join('\n');
          return new Response(JSON.stringify([[[translated]]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify([[[`[${tl}]${q}`]]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    const paragraphs = Array.from({ length: 12 }, (_, i) => ({ id: String(i), text: `Sentence number ${i} here` }));
    const out = await googleTranslate.align(paragraphs, 'Vietnamese');
    // Still just 2 requests for the whole chunk, not 24.
    expect(requestCount).toBe(2);
    expect(out).toHaveLength(12);
    expect(out[11]!.translation).toBe('[vi]Sentence number 11 here');
  });

  it('keeps gloss positions correct when a token translates to multiple words (drift fallback)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = new URL(url);
        const q = u.searchParams.get('q') ?? '';
        const tl = u.searchParams.get('tl') ?? 'en';
        if (q.includes('\n\n')) {
          return new Response(JSON.stringify([[[`[${tl}]${q}`]]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (q.includes('\n')) {
          // "world" -> "thế giới" (two target words), so the joined result has
          // MORE lines than source tokens. The fallback re-translates per token.
          const translated = q
            .split('\n')
            .map((t) => (t === 'world' ? `[${tl}]thế giới` : `[${tl}]${t}`))
            .join('\n');
          return new Response(JSON.stringify([[[translated]]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify([[[`[${tl}]${q}`]]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    const out = await googleTranslate.align([{ id: '1', text: 'Hello world' }], 'Vietnamese');
    expect(out[0]!.pairs[0]).toEqual({ source: 'Hello', target: '[vi]Hello' });
    expect(out[0]!.pairs[1]).toEqual({ source: 'world', target: '[vi]thế giới' });
  });

  it('throws (not silently returns source) when the network is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    await expect(googleTranslate.translate(['Hello'], 'Vietnamese')).rejects.toThrow(/network/i);
  });
});
