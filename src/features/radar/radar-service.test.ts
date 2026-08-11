import { describe, expect, it } from 'vitest';
import { RadarVocabularyService } from './radar-service';
import type { Settings } from '@/shared/types/settings';

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
});
