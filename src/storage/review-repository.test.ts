import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/storage/database';
import { VocabularyRepository } from '@/storage/vocabulary-repository';
import { ReviewRepository } from '@/storage/review-repository';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

function makeEntry(word: string): VocabularyEntry {
  return {
    id: `id-${word}`,
    word,
    wordKey: `key-${word}`,
    phrase: '',
    note: '',
    explanation: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false,
    tags: [],
    sentence: '',
    sourceUrl: '',
    sourceTitle: '',
    sourceLanguage: 'en',
  };
}

describe('ReviewRepository', () => {
  let db = createDatabase('review-test');
  let reviews: ReviewRepository;
  let vocabulary: VocabularyRepository;

  beforeEach(async () => {
    db = createDatabase(`review-test-${Math.random()}`);
    await db.open();
    reviews = new ReviewRepository(db);
    vocabulary = new VocabularyRepository(db);
  });

  const NOW = Date.now() + 60_000; // just past any writes in the test
  const DAY = 24 * 60 * 60 * 1000;

  it('schedules a card when a word is saved and surfaces it as due', async () => {
    const entry = makeEntry('serendipity');
    await vocabulary.save(entry);
    await reviews.ensureScheduled(entry);

    expect(await reviews.dueCount(NOW)).toBe(1);
    const due = await reviews.dueCards(10, NOW);
    expect(due).toHaveLength(1);
    expect(due[0]!.word).toBe('serendipity');
  });

  it('does not create a duplicate card on re-save', async () => {
    const entry = makeEntry('ephemeral');
    await reviews.ensureScheduled(entry);
    await reviews.ensureScheduled(entry);
    expect(await reviews.dueCount(NOW)).toBe(1);
  });

  it('pushes a card out of the due window after a Good grade', async () => {
    const entry = makeEntry('luminous');
    await reviews.ensureScheduled(entry);
    await reviews.recordGrade(entry.id, 'good', NOW);
    expect(await reviews.dueCount(NOW)).toBe(0);
    // Becomes due again after its interval elapses.
    expect(await reviews.dueCount(NOW + 3 * DAY)).toBe(1);
  });

  it('removes the card when the entry is deleted', async () => {
    const entry = makeEntry('quintessence');
    await reviews.ensureScheduled(entry);
    await reviews.remove(entry.id);
    expect(await reviews.dueCount(NOW)).toBe(0);
  });
});
