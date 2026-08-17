import Dexie, { type EntityTable } from 'dexie';
import type { VocabularyEntry } from '@/shared/types/vocabulary';
import type { RadarEntry } from '@/features/radar/types';

export const DB_NAME = 'vocab';

export interface ReviewRecord {
  /** Matches the vocabulary entry's id so a review card links to its word. */
  id: string;
  wordKey: string;
  word: string;
  ease: number;
  intervalDays: number;
  reps: number;
  dueAt: number;
  createdAt: number;
  updatedAt: number;
}

export type VocabularyDatabase = Dexie & {
  vocabulary: EntityTable<VocabularyEntry, 'id'>;
  review: EntityTable<ReviewRecord, 'id'>;
  radar: EntityTable<RadarEntry, 'id'>;
};

/**
 * Create (but do not open) a Dexie database instance.
 * Exported separately from the singleton so tests can build isolated databases.
 */
export function createDatabase(name: string = DB_NAME): VocabularyDatabase {
  const db = new Dexie(name) as VocabularyDatabase;
  db.version(1).stores({
    // `wordKey` is unique so the same word is never stored twice.
    vocabulary: 'id, &wordKey, word, createdAt, updatedAt, favorite, *tags',
  });
  // VOC-109: review scheduling table for the spaced-repetition queue.
  db.version(2).stores({
    review: 'id, wordKey, dueAt, updatedAt',
  });
  // VOC-140: word-family deduplication. Each saved concept is keyed by
  // (userId, familyId). The compound unique index `&[userId+familyId]` makes a
  // concurrent double-save a constraint violation instead of two rows, so we
  // never rely on a read-then-write check alone (which races under concurrency).
  db.version(3)
    .stores({
      vocabulary:
        'id, &wordKey, &[userId+familyId], userId, familyId, word, lemma, createdAt, updatedAt, favorite, *tags',
    })
    .upgrade((trans) => {
      // Backfill the new canonical fields for rows written by v1/v2, so the
      // unique (userId, familyId) index is satisfiable. We can't run the async
      // linguistic pipeline inside a synchronous Dexie upgrade, so we seed a
      // deterministic identity: the wordKey becomes the familyId/lemma. The next
      // save/update of that word refines it via the pipeline. A fresh, stable
      // per-install userId is assigned lazily by `getUserId()` and stamped on
      // the next write; until then we use a constant owner for existing rows.
      return trans
        .table('vocabulary')
        .toCollection()
        .modify((entry: Record<string, unknown>) => {
          const wordKey = (entry.wordKey as string) || '';
          if (!entry.userId) entry.userId = 'legacy-owner';
          if (!entry.surfaceForm) entry.surfaceForm = (entry.word as string) ?? '';
          if (!entry.normalizedForm) entry.normalizedForm = wordKey;
          if (!entry.lemma) entry.lemma = wordKey;
          if (!entry.familyId) entry.familyId = wordKey;
        });
    });
  // VOC-160: Radar vocabulary store. Each row is a generated candidate derived
  // from a saved word; `wordKey` is unique so the same candidate is never
  // stored twice (multiple saved sources are merged into `sourceIds`).
  db.version(4).stores({
    radar: 'id, &wordKey, userId, sourceId, createdAt',
  });
  // VOC-165: key deduplication on the exact word (userId + `wordKey`) instead of
  // the AI-derived familyId. The old (userId, familyId) compound index could
  // fold a newly-saved word into an *existing* entry sharing a family — e.g.
  // saving "apples" silently overwrote "apple", making the old word vanish from
  // the list. Dropping the family index and relying on the unique `&wordKey`
  // keeps every distinct saved word as its own entry. Legacy rows without a
  // userId are stamped so wordKey+userId queries still match them.
  db.version(5)
    .stores({
      vocabulary:
        'id, &wordKey, userId, familyId, word, lemma, createdAt, updatedAt, favorite, *tags',
    })
    .upgrade((trans) => {
      return trans
        .table('vocabulary')
        .toCollection()
        .modify((entry: Record<string, unknown>) => {
          if (!entry.userId) entry.userId = 'legacy-owner';
        });
    });
  return db;
}

export const db = createDatabase();
