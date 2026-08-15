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

  it('excludes saved/known families from results (personalization)', async () => {
    const page =
      'The cache must be evicted. The idempotent design avoids stale reads. The pipeline is resilient.';
    const spy = vi
      .spyOn(service as unknown as { analyzeChunk: typeof service['analyzeChunk'] }, 'analyzeChunk')
      .mockImplementation(async (): Promise<RadarCandidate[]> => [
        { text: 'cache', type: 'word', score: 98, reason: 'storage', context: '' },
        { text: 'evict', type: 'word', score: 97, reason: 'storage', context: '' },
        { text: 'idempotent', type: 'word', score: 96, reason: 'design', context: '' },
      ]);

    const result = await service.analyzePage(settings, {
      goal: 'backend english',
      pageText: page,
      pageUrl: 'https://example.com',
      knownFamilies: ['cache', 'evict'],
    });
    // 'cache' and 'evict' are known → excluded; 'idempotent' remains.
    expect(result.candidates.map((c) => c.text)).toEqual(['idempotent']);
    spy.mockRestore();
  });

  it('re-applies knownFamilies on a cache hit (user saved the word later)', async () => {
    const page = 'The cache must be evicted. The pipeline is resilient.';
    const spy = vi
      .spyOn(service as unknown as { analyzeChunk: typeof service['analyzeChunk'] }, 'analyzeChunk')
      .mockImplementation(async (): Promise<RadarCandidate[]> => [
        { text: 'cache', type: 'word', score: 98, reason: 'storage', context: '' },
        { text: 'evict', type: 'word', score: 97, reason: 'storage', context: '' },
      ]);

    // First call caches BOTH candidates (no known-families filter yet).
    await service.analyzePage(settings, {
      goal: 'backend english',
      pageText: page,
      pageUrl: 'https://example.com/cached',
    });
    expect(spy.mock.calls.length).toBe(1);

    // Second call hits the cache (no new AI call) but now excludes 'cache'
    // because it has since been saved/known.
    const result = await service.analyzePage(settings, {
      goal: 'backend english',
      pageText: page,
      pageUrl: 'https://example.com/cached',
      knownFamilies: ['cache'],
    });
    expect(spy.mock.calls.length).toBe(1); // no extra AI call
    expect(result.candidates.map((c) => c.text)).toEqual(['evict']);
    spy.mockRestore();
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
