import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VocabularyEntry, Explanation } from '@/shared/types/vocabulary';

// vi.mock factories are hoisted above imports, so the shared spies must be
// created with vi.hoisted to be visible inside the factory closures.
const h = vi.hoisted(() => {
  const addCandidates = vi.fn(
    async (_entry: VocabularyEntry, _candidates: readonly { word: string }[]) => [],
  );
  const listViews = vi.fn(async () => []);
  const findByWordKey = vi.fn(async () => undefined);
  const generate = vi.fn();
  const settingsGet = vi.fn(async () => ({ radar: { enabled: true } } as never));
  return { addCandidates, listViews, findByWordKey, generate, settingsGet };
});

vi.mock('./radar-store', () => ({
  radarStore: {
    addCandidates: h.addCandidates,
    listViews: h.listViews,
    findByWordKey: h.findByWordKey,
    removeByWordKey: vi.fn(),
    dropSource: vi.fn(),
  },
}));

vi.mock('./radar-generator', () => ({
  radarGeneratorService: { generate: h.generate },
}));

vi.mock('@/storage/settings-repository', () => ({
  settingsRepository: { get: h.settingsGet },
}));

import { generateRadarForWord, backfillRadar } from './radar-background';

const explanation: Explanation = {
  meaning: 'A fortunate accident.',
  simpleExplanation: '',
  translation: '',
  examples: [],
  synonyms: ['fortune'],
  antonyms: [],
  relatedWords: ['chance', 'luck'],
  pronunciation: '',
  collocations: ['happy accident'],
  grammar: '',
  provider: 'openai',
  model: 'gpt-4o-mini',
  generatedAt: 1,
  relatedPhrases: ['stroke of luck'],
};

const entry = {
  id: 'e1',
  word: 'serendipity',
  wordKey: 'serendipity',
  sentence: 'Pure serendipity.',
  sourceUrl: '',
  sourceTitle: '',
  note: '',
  tags: [] as string[],
  favorite: false,
  explanation,
  createdAt: 1,
  updatedAt: 1,
} as VocabularyEntry;

beforeEach(() => {
  h.addCandidates.mockClear();
  h.generate.mockReset();
  h.settingsGet.mockResolvedValue({ radar: { enabled: true } } as never);
});

describe('generateRadarForWord', () => {
  it('uses AI candidates when the generator returns them', async () => {
    h.generate.mockResolvedValue({
      candidates: [{ word: 'kismet', relationship: 'synonym', reason: 'r' }],
    });
    const count = await generateRadarForWord(entry);
    expect(count).toBe(1);
    expect(h.addCandidates).toHaveBeenCalledWith(entry, [
      { word: 'kismet', relationship: 'synonym', reason: 'r' },
    ]);
  });

  it('falls back to explanation terms when the AI returns nothing', async () => {
    h.generate.mockResolvedValue({ candidates: [] });
    const count = await generateRadarForWord(entry);
    // fortune, chance, luck, happy accident, stroke of luck
    expect(count).toBe(5);
    const passed = h.addCandidates.mock.calls[0]![1]
      .map((c) => c.word)
      .sort();
    expect(passed).toEqual(['chance', 'fortune', 'happy accident', 'luck', 'stroke of luck']);
  });

  it('falls back to explanation terms when the AI call throws', async () => {
    h.generate.mockRejectedValue(new Error('boom'));
    const count = await generateRadarForWord(entry);
    expect(count).toBe(5);
    expect(h.addCandidates).toHaveBeenCalled();
  });

  it('returns 0 (and does not store) when radar is disabled', async () => {
    h.settingsGet.mockResolvedValue({ radar: { enabled: false } } as never);
    const count = await generateRadarForWord(entry);
    expect(count).toBe(0);
    expect(h.addCandidates).not.toHaveBeenCalled();
  });
});

describe('backfillRadar', () => {
  beforeEach(() => {
    h.findByWordKey.mockResolvedValue(undefined);
  });

  it('turns already-enriched words into Radar candidates (the pre-ship gap)', async () => {
    // Words enriched before Radar shipped had no candidates. Backfill must
    // derive them from each word's existing explanation terms, with no AI call.
    const enriched = [
      { ...entry, id: 'e1', word: 'serendipity', wordKey: 'serendipity' },
      {
        ...entry,
        id: 'e2',
        word: 'ubiquitous',
        wordKey: 'ubiquitous',
        explanation: { ...explanation, synonyms: ['omnipresent'], relatedWords: ['everywhere'] },
      },
    ];
    const count = await backfillRadar({ list: async () => enriched as VocabularyEntry[] });
    expect(count).toBeGreaterThan(0);
    // No AI generation during a local-only backfill.
    expect(h.generate).not.toHaveBeenCalled();
    // Every enriched word produced at least one candidate.
    expect(h.addCandidates).toHaveBeenCalledTimes(2);
  });

  it('skips words that are already in Radar', async () => {
    h.findByWordKey.mockResolvedValue({ id: 'r1' } as never);
    const count = await backfillRadar({ list: async () => [entry] as VocabularyEntry[] });
    expect(count).toBe(0);
    expect(h.addCandidates).not.toHaveBeenCalled();
  });
});
