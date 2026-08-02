import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsRepository } from '@/storage/settings-repository';
import { TranslationService } from './translate-service';

afterEach(() => vi.unstubAllGlobals());

describe('TranslationService', () => {
  it('translates through the configured provider with its credentials', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'key-123', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
    });

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Bonjour le monde.' } }] }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const translated = await new TranslationService(settings).translate({ text: 'Hello world.' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key-123');
    expect(translated).toBe('Bonjour le monde.');
  });

  it('uses the target-language setting when the request has none', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'key', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
      targetLanguage: 'French',
    });

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Bonjour.' } }] }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await new TranslationService(settings).translate({ text: 'Hello.' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const messages = JSON.parse(init.body as string).messages as Array<{ content: string }>;
    const userMessage = messages[1];
    expect(userMessage?.content).toContain('French');
    expect(userMessage?.content).toContain('Hello.');
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
            json: async () => ({ content: [{ type: 'text', text: 'Bonjour.' }] }),
            text: async () => '',
          } as unknown as Response;
        }
        throw new Error('network down');
      }),
    );

    const translated = await new TranslationService(settings).translate({ text: 'Hello.' });
    expect(translated).toBe('Bonjour.');
  });

  it('surfaces a missing key as an AiError', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: '', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
    });

    await expect(new TranslationService(settings).translate({ text: 'Hello.' })).rejects.toMatchObject({
      code: 'missing_api_key',
    });
  });
});
