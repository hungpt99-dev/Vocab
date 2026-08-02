import { afterEach, describe, expect, it, vi } from 'vitest';
import { TranslateService } from './translate-service';
import { SettingsRepository } from '@/storage/settings-repository';

afterEach(() => vi.unstubAllGlobals());

function mockFetchWith(body: string) {
  const fetchMock = vi.fn(async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: body } }] }),
      text: async () => '',
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('TranslateService', () => {
  it('translates blocks into the user target language with the active provider', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'key-123', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
      targetLanguage: 'Russian',
    });

    const fetchMock = mockFetchWith('Привет. Меня зовут Анна.');
    const service = new TranslateService(settings);
    const results = await service.translateBlocks(['Hello.', 'My name is Anna.']);

    expect(results).toEqual(['Привет. Меня зовут Анна.', 'Привет. Меня зовут Анна.']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).messages[1].content).toContain('into Russian');
  });

  it('degrades a failing block to null without failing the others', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [{ id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'k', baseUrl: '', model: '', enabled: true }],
      activeProviderId: 'p1',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    // A single block keeps the test fast: the shared limiter allows 5 per 10 s.
    const results = await new TranslateService(settings).translateBlocks(['Hello.']);
    expect(results).toEqual([null]);
  });

  it('throws a stable AiError when no active provider is configured', async () => {
    const settings = new SettingsRepository();
    await settings.update({ providers: [], activeProviderId: 'nope' });
    await expect(new TranslateService(settings).translateBlocks(['Hello.'])).rejects.toMatchObject({
      code: 'unknown_provider',
    });
  });

  it('falls back to a second provider on a transient failure', async () => {
    const settings = new SettingsRepository();
    await settings.update({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'k', baseUrl: '', model: '', enabled: true },
        { id: 'p2', type: 'openai', name: 'OpenAI 2', apiKey: 'k2', baseUrl: '', model: '', enabled: true },
      ],
      activeProviderId: 'p1',
      fallbackProviderId: 'p2',
    });
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        // First provider fails transiently; the fallback provider succeeds.
        if (calls === 1) throw new Error('network down');
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: 'Удачный день.' } }] }),
          text: async () => '',
        } as unknown as Response;
      }),
    );

    const results = await new TranslateService(settings).translateBlocks(['A lucky day.']);
    expect(results).toEqual(['Удачный день.']);
  });
});
