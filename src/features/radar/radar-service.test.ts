import { describe, expect, it, vi } from 'vitest';
import { RadarVocabularyService } from './radar-service';
import type { Settings } from '@/shared/types/settings';
import type { RadarCandidate } from './types';

const service = new RadarVocabularyService();

// Minimal settings; only used by analyzePage to choose a provider. The tests
// below exercise the network-free paths (rankFromText, empty input). The AI
// call path is covered by the handler integration test with a mocked service.
const settings = {
  activeProviderId: 'openai',
  providers: [],
} as unknown as Settings;

describe('RadarVocabularyService.rankFromText', () => {
  const page = 'The API must be idempotent. The system can gracefully degrade under load.';

  it('validates, dedupes and ranks from a raw AI response', () => {
    const response = JSON.stringify({
      candidates: [
        { text: 'idempotent', type: 'word', score: 98, reason: 'API design' },
        { text: 'gracefully degrade', type: 'phrase', score: 96, reason: 'resilience' },
        { text: 'blockchain', type: 'word', score: 99, reason: 'not on page' },
      ],
    });
    const ranked = service.rankFromText(response, page, 5);
    expect(ranked.map((r) => r.text)).toEqual(['idempotent', 'gracefully degrade']);
  });

  it('limits to Top N', () => {
    const response = JSON.stringify({
      candidates: [
        { text: 'idempotent', type: 'word', score: 98 },
        { text: 'gracefully degrade', type: 'phrase', score: 96 },
      ],
    });
    expect(service.rankFromText(response, page, 1)).toHaveLength(1);
  });

  it('throws on invalid JSON so callers can surface a retry', () => {
    expect(() => service.rankFromText('garbage', page)).toThrow();
  });
});

describe('RadarVocabularyService.analyzePage', () => {
  it('returns no candidates for empty page text (no AI call)', async () => {
    const result = await service.analyzePage(settings, {
      goal: 'learn backend english',
      pageText: '   ',
      pageUrl: 'https://example.com',
    });
    expect(result.candidates).toEqual([]);
    expect(result.chunksTotal).toBe(0);
  });

  it('analyzes chunks concurrently, not serially', async () => {
    // Force many small chunks: each section is one short sentence, and a tiny
    // maxChars makes every section split into >=2 hard chunks. With 8 sections
    // that's 16+ analyzeChunk calls. Serial (await-per-chunk) would take
    // 16 * 30ms ≈ 480ms; concurrency 4 brings it to ~4 * 30ms. We assert the
    // wall-clock is far below the serial sum, proving the pipeline no longer
    // awaits one chunk at a time (the old slowness on long pages).
    const page = Array.from(
      { length: 8 },
      (_, i) => `Section ${i} the api must be idempotent and resilient under load okay.`,
    ).join('\n\n');

    const spy = vi
      .spyOn(service as unknown as { analyzeChunk: typeof service['analyzeChunk'] }, 'analyzeChunk')
      .mockImplementation(async (_s: Settings, _g: string, _chunk: string, _sig?: AbortSignal): Promise<RadarCandidate[]> => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return [{ text: 'idempotent', type: 'word', score: 98, reason: 'API', context: '' }];
      });

    const start = Date.now();
    const result = await service.analyzePage(settings, {
      goal: 'backend engineering',
      pageText: page,
      pageUrl: 'https://example.com',
      chunkOptions: { maxChars: 40, overlapChars: 0 },
      concurrency: 4,
    });
    const elapsed = Date.now() - start;
    const calls = spy.mock.calls.length;

    expect(calls).toBeGreaterThan(1);
    expect(result.chunksAnalyzed).toBe(calls);
    // Wall-clock must be well under the serial sum (each chunk "costs" 30ms).
    expect(elapsed).toBeLessThan(calls * 30);

    spy.mockRestore();
  });
});
