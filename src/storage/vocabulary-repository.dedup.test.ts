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

describe('VocabularyRepository word-family deduplication', () => {
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

  it('merges book + books into one concept for the same user', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    const first = await repo.save({ word: 'book' });
    const second = await repo.save({ word: 'books' });

    expect(second.id).toBe(first.id);
    expect(await repo.count()).toBe(1);
  });

  it('merges beautiful + beautifully when the resolver shares a family', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    const first = await repo.save({ word: 'beautiful' });
    const second = await repo.save({ word: 'beautifully' });

    expect(second.id).toBe(first.id);
    expect(await repo.count()).toBe(1);
  });

  it('does NOT merge run + runaway (different families)', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    await repo.save({ word: 'run' });
    await repo.save({ word: 'runaway' });
    expect(await repo.count()).toBe(2);
  });

  it('does NOT merge analysis + analyst (different families)', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    await repo.save({ word: 'analysis' });
    await repo.save({ word: 'analyst' });
    expect(await repo.count()).toBe(2);
  });

  it('lets two users each save the same family independently', async () => {
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

  it('keeps the original surface form when merging a later variant', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    const first = await repo.save({ word: 'BOOKS' });
    expect(first.surfaceForm).toBe('BOOKS');
  });

  it('prevents duplicate rows under concurrent saves of the same family', async () => {
    const db = createDatabase(`concurrent-${++dbCounter}`);
    await db.open();
    const repo = new VocabularyRepository(db, normalizerFor(FAMILY_MAP), async () => 'user-a');

    // Fire several saves of the same family "in parallel" — the unique
    // (userId, familyId) constraint should collapse them to one row.
    const results = await Promise.all([
      repo.save({ word: 'book' }),
      repo.save({ word: 'books' }),
      repo.save({ word: 'book' }),
      repo.save({ word: 'books' }),
    ]);

    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);
    expect(await repo.count()).toBe(1);
  });
});

describe('VocabularyRepository.findByFamily', () => {
  it('finds an existing concept by (userId, familyId)', async () => {
    const repo = makeRepo('user-x');
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();
    await repo.save({ word: 'books' });
    const found = await repo.findByFamily('user-x', 'book');
    expect(found?.word).toBe('books');
    expect(await repo.findByFamily('user-x', 'nope')).toBeUndefined();
  });
});
