import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplainService } from './explain-service';
import { SettingsRepository } from '@/storage/settings-repository';

const payload = JSON.stringify({ meaning: 'm', simpleExplanation: 's', examples: [], synonyms: [], pronunciation: '', collocations: [] });

afterEach(() => vi.unstubAllGlobals());

describe('ExplainService', () => {
  it('uses the configured provider and credentials', async () => {
    const settings = new SettingsRepository();
    await settings.update({ provider: 'anthropic', apiKey: 'key-123' });

    const fetchMock = vi.fn(async () =>
      ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: payload }] }), text: async () => '' }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    const explanation = await new ExplainService(settings).explain({ word: 'x' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('key-123');
    expect(explanation.provider).toBe('anthropic');
  });

  it('surfaces a missing key as an AiError', async () => {
    const settings = new SettingsRepository();
    await settings.update({ provider: 'openai', apiKey: '' });
    await expect(new ExplainService(settings).explain({ word: 'x' })).rejects.toMatchObject({
      code: 'missing_api_key',
    });
  });
});
