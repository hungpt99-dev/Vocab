import { beforeEach, describe, expect, it } from 'vitest';
import { VocabularyRepository } from './vocabulary-repository';
import { createDatabase, type VocabularyDatabase } from './database';
import { createId } from '@/shared/lib/id';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

function daysAgo(n: number): number {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

async function seed(db: VocabularyDatabase, word: string, createdAt: number): Promise<void> {
  const entry: VocabularyEntry = {
    id: createId(),
    word,
    wordKey: word.toLowerCase(),
    phrase: '',
    sentence: '',
    sourceUrl: '',
    sourceTitle: '',
    note: '',
    tags: [],
    favorite: false,
    sourceLanguage: '',
    explanation: null,
    createdAt,
    updatedAt: createdAt,
  };
  await db.vocabulary.add(entry);
}

describe('VocabularyRepository.stats', () => {
  let repo: VocabularyRepository;
  let db: VocabularyDatabase;
  beforeEach(async () => {
    db = createDatabase('test-stats');
    await db.open();
    await db.vocabulary.clear();
    repo = new VocabularyRepository(db);
  });

  it('returns zeros for an empty store', async () => {
    expect(await repo.stats()).toEqual({ total: 0, addedToday: 0, streak: 0 });
  });

  it('counts total and words added today', async () => {
    await seed(db, 'apple', daysAgo(0));
    await seed(db, 'banana', daysAgo(0));
    await seed(db, 'cherry', daysAgo(2));
    const stats = await repo.stats();
    expect(stats.total).toBe(3);
    expect(stats.addedToday).toBe(2);
  });

  it('computes a consecutive-day streak ending today', async () => {
    await seed(db, 'a', daysAgo(0));
    await seed(db, 'b', daysAgo(1));
    await seed(db, 'c', daysAgo(2));
    expect((await repo.stats()).streak).toBe(3);
  });

  it('counts a streak ending yesterday when nothing was saved today', async () => {
    await seed(db, 'a', daysAgo(1));
    await seed(db, 'b', daysAgo(2));
    const stats = await repo.stats();
    expect(stats.streak).toBe(2);
    expect(stats.addedToday).toBe(0);
  });

  it('breaks the streak on a skipped day', async () => {
    await seed(db, 'a', daysAgo(0));
    await seed(db, 'b', daysAgo(2));
    expect((await repo.stats()).streak).toBe(1);
  });
});
