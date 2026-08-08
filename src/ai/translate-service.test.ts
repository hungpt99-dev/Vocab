import { afterEach, describe, expect, it, vi } from 'vitest';
import { TranslateService } from './translate-service';
import { SettingsRepository } from '@/storage/settings-repository';

/** A provider with no key set, so the keyless fallback path is exercised. */
const NO_KEY = '';


/** Build a translations payload sized to match the request body's paragraph count. */
function translationPayload(body: string): string {
  const match = body.match(/Translate the (\d+) paragraph/);
  const count = match ? Number(match[1]) : 1;
  const translations = Array.from({ length: count }, (_, index) => `T${index + 1}`);
  return JSON.stringify({ translations });
}

afterEach(() => vi.unstubAllGlobals());

describe('TranslateService', () => {
  it('uses the configured provider and posts paragraph translations', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'anthropic', name: 'Claude', apiKey: 'key-123', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
    });

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: 'text', text: translationPayload(init?.body as string) }] }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new TranslateService(settings).translate(
      [
        { id: 'a', text: 'Hello' },
        { id: 'b', text: 'World' },
      ],
      'Spanish',
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('key-123');
    const body = JSON.parse(init.body as string);
    expect(body.messages[0].content).toContain('Hello');
    expect(result).toMatchObject([
      { id: 'a', text: 'Hello', translation: 'T1' },
      { id: 'b', text: 'World', translation: 'T2' },
    ]);
  });

  it('falls back to the keyless endpoint when the active provider needs a key but has none', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: '', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
    });

    // Emulate the no-key Google endpoint (ISO code in `tl`, gtx response shape).
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      const q = u.searchParams.get('q') ?? '';
      const tl = u.searchParams.get('tl') ?? 'en';
      return {
        ok: true,
        status: 200,
        json: async () => [[[`[${tl}]${q}`]]],
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new TranslateService(settings).translate(
      [
        { id: 'a', text: 'Hello' },
        { id: 'b', text: 'World' },
      ],
      'Vietnamese',
    );

    // The provider path must NOT have been used (it would post to chat/completions).
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('chat/completions'))).toBe(false);
    // The keyless endpoint was hit with the ISO code, not the display name.
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('tl=vi'))).toBe(true);
    expect(result).toEqual([
      { id: 'a', text: 'Hello', translation: '[vi]Hello' },
      { id: 'b', text: 'World', translation: '[vi]World' },
    ]);
  });

  it('caches the keyless fallback so a re-render does not re-hit the network', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: NO_KEY, baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
    });

    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      const q = u.searchParams.get('q') ?? '';
      const tl = u.searchParams.get('tl') ?? 'en';
      return {
        ok: true,
        status: 200,
        json: async () => [[[`[${tl}]${q}`]]],
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new TranslateService(settings);
    const paragraphs = [{ id: 'a', text: 'Hello' }];
    await service.alignWords(paragraphs, 'Vietnamese');
    fetchMock.mockClear();
    await service.alignWords(paragraphs, 'Vietnamese');

    // Second call served from cache: no Google requests at all.
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('uses the configured provider when a key is present (no keyless fallback)', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'sk-test', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
    });

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body as string;
      const count = (body.match(/Translate the (\d+) paragraph/) ?? [])[1] ?? '1';
      const translations = Array.from({ length: Number(count) }, (_, i) => `T${i + 1}`);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ translations }) } }] }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new TranslateService(settings).translate(
      [
        { id: 'a', text: 'Hello' },
        { id: 'b', text: 'World' },
      ],
      'Spanish',
    );

    expect((fetchMock.mock.calls[0]![1]!.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-test');
    // The keyless endpoint must NOT have been used.
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('translate.googleapis.com'))).toBe(false);
    expect(result).toMatchObject([
      { id: 'a', text: 'Hello', translation: 'T1' },
      { id: 'b', text: 'World', translation: 'T2' },
    ]);
  });

  it('chunks long articles across multiple provider calls in order', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'k', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
    });

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: translationPayload(init?.body as string) } }] }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const paragraphs = Array.from({ length: 20 }, (_, index) => ({ id: `p${index}`, text: `Para ${index}` }));
    const result = await new TranslateService(settings).translate(paragraphs, 'Spanish');

    // CHUNK_SIZE is 16, so 20 paragraphs span two chunks (still order-preserving).
    // Each chunk is translated independently, so the mock yields T1..T16 then T1..T4.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(20);
    expect(result[0]).toMatchObject({ id: 'p0', text: 'Para 0', translation: 'T1' });
    expect(result[15]).toMatchObject({ id: 'p15', text: 'Para 15', translation: 'T16' });
    expect(result[16]).toMatchObject({ id: 'p16', text: 'Para 16', translation: 'T1' });
    expect(result[19]).toMatchObject({ id: 'p19', text: 'Para 19', translation: 'T4' });
  });

  it('serves repeated requests from the cache', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'k', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
    });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: translationPayload(init?.body as string) } }] }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new TranslateService(settings);
    await service.translate([{ id: 'a', text: 'Hello' }], 'Spanish');
    await service.translate([{ id: 'a', text: 'Hello' }], 'Spanish');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('attaches a BilingualPerf breakdown to the first result for debug logging', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'sk-test', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
    });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: translationPayload(init?.body as string) } }] }),
      text: async () => '',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new TranslateService(settings).translate(
      [
        { id: 'a', text: 'Hello' },
        { id: 'b', text: 'World' },
      ],
      'Spanish',
    );

    expect(result[0]?.perf).toBeDefined();
    expect(result[0]?.perf).toMatchObject({
      chunks: 1,
      cacheHits: 0,
      rateLimitWaitMs: expect.any(Number),
      providerMs: expect.any(Number),
      totalMs: expect.any(Number),
    });
  });
});
