import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplainService } from './explain-service';
import { SettingsRepository } from '@/storage/settings-repository';

const payload = JSON.stringify({ meaning: 'm', simpleExplanation: 's', examples: [], synonyms: [], pronunciation: '', collocations: [] });

afterEach(() => vi.unstubAllGlobals());

describe('ExplainService', () => {
  it('uses the configured provider and credentials', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [{ id: 'p1', type: 'anthropic', name: 'Claude', apiKey: 'key-123', baseUrl: '', model: '', enabled: true }],
      activeProviderId: 'p1',
    });

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: 'text', text: payload }] }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const explanation = await new ExplainService(settings).explain({ word: 'x' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('key-123');
    expect(explanation.provider).toBe('anthropic');
  });

  it('surfaces a missing key as an AiError', async () => {
    const settings = new SettingsRepository();
    await settings.update({ providers: [{ id: 'p1', type: 'openai', name: 'OpenAI', apiKey: '', baseUrl: '', model: '', enabled: true }], activeProviderId: 'p1' });
    await expect(new ExplainService(settings).explain({ word: 'x' })).rejects.toMatchObject({
      code: 'missing_api_key',
    });
  });

  it('uses the settings target language when the request omits one', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [{ id: 'p1', type: 'anthropic', name: 'Claude', apiKey: 'key-123', baseUrl: '', model: '', enabled: true }],
      activeProviderId: 'p1',
      targetLanguage: 'French',
    });

    let body: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: 'text', text: payload }] }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await new ExplainService(settings).explain({ word: 'x' });

    const messages = (body as { messages?: Array<{ content?: string }> }).messages ?? [];
    expect(messages[0]?.content).toContain('Explain it in French.');
  });

  it('falls back to a second provider on a transient error', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'k', baseUrl: '', model: '', enabled: true },
        { id: 'p2', type: 'anthropic', name: 'Claude', apiKey: 'k2', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
      fallbackProviderId: 'p2',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('api.anthropic.com')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ content: [{ type: 'text', text: payload }] }),
            text: async () => '',
          } as unknown as Response;
        }
        // The active (OpenAI) provider always fails transiently.
        throw new Error('network down');
      }),
    );

    const explanation = await new ExplainService(settings).explain({ word: 'x' });
    expect(explanation.provider).toBe('anthropic');
  });
});
