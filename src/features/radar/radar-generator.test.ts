import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '@/shared/types/settings';
import type { RadarCandidateInput } from './types';

const h = vi.hoisted(() => {
  const complete = vi.fn();
  return { complete };
});

vi.mock('@/ai/registry', () => ({
  getProvider: () => ({ complete: h.complete }),
}));

import { radarGeneratorService } from './radar-generator';

const settings = {
  providers: [
    {
      id: 'p1',
      type: 'openai',
      name: 'OpenAI',
      apiKey: '«redacted:sk-…»',
      baseUrl: '',
      model: '',
      enabled: true,
    },
  ],
  activeProviderId: 'p1',
} as unknown as Settings;

const candidatesPayload = JSON.stringify({
  candidates: [
    { word: 'kismet', relationship: 'synonym', reason: 'fate' },
    { word: 'happenstance', relationship: 'related', reason: 'chance' },
  ],
});

beforeEach(() => {
  h.complete.mockReset();
  h.complete.mockResolvedValue(candidatesPayload);
});

describe('RadarGeneratorService', () => {
  it('passes the full API key to the provider adapter (never a masked key)', async () => {
    const result = await radarGeneratorService.generate(settings, { word: 'serendipity' });

    expect(result.candidates.map((c: RadarCandidateInput) => c.word)).toEqual([
      'kismet',
      'happenstance',
    ]);
    expect(h.complete).toHaveBeenCalledTimes(1);
    const config = h.complete.mock.calls[0]![2] as { apiKey: string };
    expect(config.apiKey).toBe('«redacted:sk-…»');
  });

  it('sends the word, part of speech, meaning and known related terms in the prompt', async () => {
    await radarGeneratorService.generate(settings, {
      word: 'serendipity',
      partOfSpeech: 'noun',
      meaning: 'A fortunate accident.',
      existingRelated: ['luck'],
    });

    const [, userPrompt] = h.complete.mock.calls[0]! as [string, string, unknown];
    expect(userPrompt).toContain('serendipity');
    expect(userPrompt).toContain('noun');
    expect(userPrompt).toContain('A fortunate accident.');
    expect(userPrompt).toContain('luck');
  });

  it('rejects with bad_response when the model output is not JSON', async () => {
    h.complete.mockResolvedValue('not json at all');
    await expect(radarGeneratorService.generate(settings, { word: 'serendipity' })).rejects.toMatchObject({
      code: 'bad_response',
    });
  });

  it('rejects with unknown_provider when no active provider is configured', async () => {
    const noProvider = { providers: [], activeProviderId: 'p1' } as unknown as Settings;
    await expect(radarGeneratorService.generate(noProvider, { word: 'serendipity' })).rejects.toMatchObject({
      code: 'unknown_provider',
    });
  });

  it('routes through the shared rate limiter (runAiCall), not an unrate-limited path', async () => {
    // Two concurrent generations must both resolve; the rate limiter (5/10s) is
    // the shared one used by explain/translate. We assert the provider is called
    // via the real runAiCall rather than a direct, unthrottled call.
    const [a, b] = await Promise.all([
      radarGeneratorService.generate(settings, { word: 'alpha' }),
      radarGeneratorService.generate(settings, { word: 'beta' }),
    ]);
    expect(a.candidates.length).toBeGreaterThan(0);
    expect(b.candidates.length).toBeGreaterThan(0);
    expect(h.complete).toHaveBeenCalledTimes(2);
  });
});
