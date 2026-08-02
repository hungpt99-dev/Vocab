import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OpenAiCompatibleProvider, OPENAI_COMPATIBLE_PRESETS } from './openai-compatible';
import { AiError } from '../types';

const payload = JSON.stringify({
  meaning: 'A fortunate accident.',
  simpleExplanation: 'Good luck.',
  examples: ['Example one.'],
  synonyms: ['luck'],
  pronunciation: '/x/',
  collocations: ['pure serendipity'],
});

type FetchCall = [string, RequestInit];

/** Read a recorded fetch call as a typed [url, init] tuple. */
function callAt(fetchMock: { mock: { calls: unknown[] } }, index: number): FetchCall {
  return fetchMock.mock.calls[index] as unknown as FetchCall;
}

function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn(async () =>
    ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    }) as unknown as Response,
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const config = { apiKey: 'sk-test', model: '', baseUrl: '' };
const request = { word: 'serendipity', context: 'Pure serendipity struck.' };

afterEach(() => vi.unstubAllGlobals());

describe('OpenAiCompatibleProvider', () => {
  const preset = OPENAI_COMPATIBLE_PRESETS[0]!;
  let provider: OpenAiCompatibleProvider;

  beforeEach(() => {
    provider = new OpenAiCompatibleProvider(preset);
  });

  it('posts to the chat-completions endpoint with bearer auth', async () => {
    const fetchMock = mockFetch({ choices: [{ message: { content: payload } }], model: 'gpt-4o-mini' });
    const explanation = await provider.explain(request, config);

    const [url, init] = callAt(fetchMock, 0);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body as string).model).toBe('gpt-4o-mini');
    expect(explanation.meaning).toBe('A fortunate accident.');
    expect(explanation.provider).toBe('openai');
  });

  it('honours a custom base URL and model', async () => {
    const fetchMock = mockFetch({ choices: [{ message: { content: payload } }] });
    await provider.explain(request, { ...config, baseUrl: 'http://localhost:9/v1/', model: 'custom' });

    expect(callAt(fetchMock, 0)[0]).toBe('http://localhost:9/v1/chat/completions');
  });

  it('requires an API key when the preset demands one', async () => {
    await expect(provider.explain(request, { ...config, apiKey: '' })).rejects.toMatchObject({
      code: 'missing_api_key',
    });
  });

  it('allows local providers without an API key', async () => {
    const local = new OpenAiCompatibleProvider(
      OPENAI_COMPATIBLE_PRESETS.find((p) => p.id === 'ollama')!,
    );
    const fetchMock = mockFetch({ choices: [{ message: { content: payload } }] });
    await local.explain(request, { ...config, apiKey: '' });

    const [, init] = callAt(fetchMock, 0);
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('maps 401 responses to unauthorized', async () => {
    mockFetch('nope', { ok: false, status: 401 });
    await expect(provider.explain(request, config)).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('maps 429 responses to rate_limited', async () => {
    mockFetch('slow down', { ok: false, status: 429 });
    await expect(provider.explain(request, config)).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('maps 500 responses to server_error', async () => {
    mockFetch('boom', { ok: false, status: 500 });
    await expect(provider.explain(request, config)).rejects.toMatchObject({ code: 'server_error' });
  });

  it('rejects an empty choice list', async () => {
    mockFetch({ choices: [] });
    await expect(provider.explain(request, config)).rejects.toThrow(/empty response/);
  });

  it('normalises transport failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const error = await provider.explain(request, config).catch((e: AiError) => e);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).code).toBe('network');
  });

  it('propagates caller aborts', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      }),
    ));
    const promise = provider.explain(request, { ...config, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('GeminiProvider', () => {
  const provider = new GeminiProvider();

  it('calls generateContent with the api key header', async () => {
    const fetchMock = mockFetch({ candidates: [{ content: { parts: [{ text: payload }] } }] });
    const explanation = await provider.explain(request, config);

    const [url, init] = callAt(fetchMock, 0);
    expect(url).toContain('models/gemini-1.5-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('sk-test');
    expect(explanation.provider).toBe('gemini');
  });

  it('requires an API key', async () => {
    await expect(provider.explain(request, { ...config, apiKey: '' })).rejects.toMatchObject({
      code: 'missing_api_key',
    });
  });

  it('rejects an empty candidate list', async () => {
    mockFetch({ candidates: [] });
    await expect(provider.explain(request, config)).rejects.toThrow(/empty response/);
  });
});

describe('AnthropicProvider', () => {
  const provider = new AnthropicProvider();

  it('calls the messages endpoint with anthropic headers', async () => {
    const fetchMock = mockFetch({ content: [{ type: 'text', text: payload }], model: 'claude-3-5-haiku-latest' });
    const explanation = await provider.explain(request, config);

    const [url, init] = callAt(fetchMock, 0);
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(explanation.provider).toBe('anthropic');
  });

  it('requires an API key', async () => {
    await expect(provider.explain(request, { ...config, apiKey: '' })).rejects.toMatchObject({
      code: 'missing_api_key',
    });
  });

  it('rejects an empty content list', async () => {
    mockFetch({ content: [] });
    await expect(provider.explain(request, config)).rejects.toThrow(/empty response/);
  });
});
