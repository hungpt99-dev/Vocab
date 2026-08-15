import { describe, expect, it } from 'vitest';
import { createDatabase } from './database';
import { VocabularyRepository } from './vocabulary-repository';
import type { LinguisticAnalyzer } from '@/features/vocabulary/linguistic-analyzer';
import type { LinguisticAnalysis } from '@/features/vocabulary/types';
import { DefaultVocabularyNormalizationService, type VocabularyNormalizationService } from '@/features/vocabulary/vocabulary-normalization-service';

let dbCounter = 0;

/** Stub analyzer that maps a word to a deterministic lemma/family. */
function analyzerFor(map: Record<string, Partial<LinguisticAnalysis>>): LinguisticAnalyzer {
  return {
    analyze: async (word: string) => {
      const base = {
        singular: word,
        lemma: word,
        partOfSpeech: 'noun' as const,
        familyId: word.toLowerCase(),
        confident: true,
      };
      return { ...base, ...(map[word.toLowerCase()] ?? {}) };
    },
  };
}

/** Wrap a stub analyzer in a normalization service (the repo's dependency). */
function normalizerFor(map: Record<string, Partial<LinguisticAnalysis>>): VocabularyNormalizationService {
  return new DefaultVocabularyNormalizationService({ analyzer: analyzerFor(map) });
}

const FAMILY_MAP: Record<string, Partial<LinguisticAnalysis>> = {
  book: { singular: 'book', lemma: 'book', familyId: 'book' },
  books: { singular: 'book', lemma: 'book', familyId: 'book' },
  beautiful: { lemma: 'beautiful', familyId: 'beauty' },
  beautifully: { lemma: 'beautifully', familyId: 'beauty' },
  run: { lemma: 'run', familyId: 'run' },
  runaway: { lemma: 'runaway', familyId: 'runaway' },
  analysis: { lemma: 'analysis', familyId: 'analysis' },
  analyst: { lemma: 'analyst', familyId: 'analyst' },
};

function makeRepo(userId = 'user-a'): VocabularyRepository {
  dbCounter += 1;
  const db = createDatabase(`dedup-test-${dbCounter}`);
  return new VocabularyRepository(db, normalizerFor(FAMILY_MAP), async () => userId);
}

describe('VocabularyRepository deduplication (exact word)', () => {
  it('stores a new entry with canonical fields from the pipeline', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    const entry = await repo.save({ word: '  BOOKS  ' });

    expect(entry.surfaceForm).toBe('BOOKS');
    expect(entry.normalizedForm).toBe('books');
    expect(entry.lemma).toBe('book');
    expect(entry.familyId).toBe('book');
    expect(await repo.count()).toBe(1);
  });

  it('keeps book + books as TWO separate entries (distinct words, not family-merged)', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    const first = await repo.save({ word: 'book' });
    const second = await repo.save({ word: 'books' });

    expect(second.id).not.toBe(first.id);
    expect(await repo.count()).toBe(2);
  });

  it('keeps beautiful + beautifully as TWO separate entries', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    await repo.save({ word: 'beautiful' });
    await repo.save({ word: 'beautifully' });
    expect(await repo.count()).toBe(2);
  });

  it('keeps run + runaway as two separate entries', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    await repo.save({ word: 'run' });
    await repo.save({ word: 'runaway' });
    expect(await repo.count()).toBe(2);
  });

  it('keeps analysis + analyst as two separate entries', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    await repo.save({ word: 'analysis' });
    await repo.save({ word: 'analyst' });
    expect(await repo.count()).toBe(2);
  });

  it('merges a re-save of the EXACT same word for the same user', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    const first = await repo.save({ word: 'book' });
    const second = await repo.save({ word: 'BOOK' });

    expect(second.id).toBe(first.id);
    expect(await repo.count()).toBe(1);
  });

  it('lets two users each save the same word independently', async () => {
    const db = createDatabase(`multiuser-${++dbCounter}`);
    await db.open();
    const repoA = new VocabularyRepository(db, normalizerFor(FAMILY_MAP), async () => 'user-a');
    const repoB = new VocabularyRepository(db, normalizerFor(FAMILY_MAP), async () => 'user-b');

    const a = await repoA.save({ word: 'book' });
    const b = await repoB.save({ word: 'books' });

    expect(a.id).not.toBe(b.id);
    expect(a.userId).toBe('user-a');
    expect(b.userId).toBe('user-b');
    expect(await repoA.count()).toBe(2);
  });

  it('keeps the original surface form when merging a later identical word', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    const first = await repo.save({ word: 'BOOKS' });
    expect(first.surfaceForm).toBe('BOOKS');
  });

  it('does not lose an existing entry when a different word is saved', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    const first = await repo.save({ word: 'book' });
    await repo.save({ word: 'books' });
    const stillThere = await repo.findByWord('book');
    expect(stillThere?.id).toBe(first.id);
    expect(await repo.count()).toBe(2);
  });

  it('prevents duplicate rows under concurrent saves of the SAME word', async () => {
    const db = createDatabase(`concurrent-${++dbCounter}`);
    await db.open();
    const repo = new VocabularyRepository(db, normalizerFor(FAMILY_MAP), async () => 'user-a');

    const results = await Promise.all([
      repo.save({ word: 'book' }),
      repo.save({ word: 'book' }),
      repo.save({ word: 'BOOK' }),
      repo.save({ word: 'book' }),
    ]);

    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);
    expect(await repo.count()).toBe(1);
  });
});

describe('VocabularyRepository.findByWordKey', () => {
  it('finds an existing entry by exact word key', async () => {
    const repo = makeRepo('user-x');
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    await repo.save({ word: 'books' });
    const found = await repo.findByWordKey('user-x', 'books');
    expect(found?.word).toBe('books');
    expect(await repo.findByWordKey('user-x', 'nope')).toBeUndefined();
  });
});
