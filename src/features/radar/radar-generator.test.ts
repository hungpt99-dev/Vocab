import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '@/shared/types/settings';
import type { SavedProvider } from '@/shared/types/settings';
import type { RadarCandidateInput } from './types';

const h = vi.hoisted(() => {
  const complete = vi.fn();
  const runWithFallback = vi.fn();
  return { complete, runWithFallback };
});

vi.mock('@/ai/registry', () => ({
  getProvider: () => ({ complete: h.complete }),
}));

vi.mock('@/ai/pipeline', () => ({
  runWithFallback: h.runWithFallback,
}));

import { radarGeneratorService } from './radar-generator';

const settings = { providers: [], activeProviderId: 'p1' } as unknown as Settings;

const candidatesPayload = JSON.stringify({
  candidates: [
    { word: 'kismet', relationship: 'synonym', reason: 'fate' },
    { word: 'happenstance', relationship: 'related', reason: 'chance' },
  ],
});

beforeEach(() => {
  h.complete.mockReset();
  h.runWithFallback.mockReset();
  h.complete.mockResolvedValue(candidatesPayload);
  h.runWithFallback.mockImplementation(
    async (_settings: Settings, run: (provider: SavedProvider) => Promise<unknown>) => {
      const provider = {
        type: 'openai',
        name: 'OpenAI',
        apiKey: 'sk-abcdef1234567890',
        baseUrl: '',
        model: '',
        enabled: true,
      } as SavedProvider;
      return { value: await run(provider), active: provider };
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('RadarGeneratorService', () => {
  it('passes the full API key to the provider adapter (never a masked key)', async () => {
    const result = await radarGeneratorService.generate(settings, { word: 'serendipity' });

    expect(result.candidates.map((c: RadarCandidateInput) => c.word)).toEqual([
      'kismet',
      'happenstance',
    ]);
    expect(h.complete).toHaveBeenCalledTimes(1);
    const config = h.complete.mock.calls[0]![2] as { apiKey: string };
    expect(config.apiKey).toBe('sk-abcdef1234567890');
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
});