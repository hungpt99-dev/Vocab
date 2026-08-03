import { afterEach, describe, expect, it, vi } from 'vitest';
import { TranslateService } from './translate-service';
import { SettingsRepository } from '@/storage/settings-repository';

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
    expect(result).toEqual([
      { id: 'a', text: 'Hello', translation: 'T1' },
      { id: 'b', text: 'World', translation: 'T2' },
    ]);
  });

  it('surfaces a missing key as an AiError', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: '', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
    });
    await expect(new TranslateService(settings).translate([{ id: 'a', text: 'Hi' }], 'Spanish')).rejects.toMatchObject(
      { code: 'missing_api_key' },
    );
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

    const paragraphs = Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, text: `Para ${index}` }));
    const result = await new TranslateService(settings).translate(paragraphs, 'Spanish');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ id: 'p0', text: 'Para 0', translation: 'T1' });
    expect(result[9]).toEqual({ id: 'p9', text: 'Para 9', translation: 'T2' });
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
});
