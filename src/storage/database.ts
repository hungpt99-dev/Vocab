import Dexie, { type EntityTable } from 'dexie';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

export const DB_NAME = 'ai-vocabulary-saver';
export const DB_VERSION = 1;

export type VocabularyDatabase = Dexie & {
  vocabulary: EntityTable<VocabularyEntry, 'id'>;
};

/**
 * Create (but do not open) a Dexie database instance.
 * Exported separately from the singleton so tests can build isolated databases.
 */
export function createDatabase(name: string = DB_NAME): VocabularyDatabase {
  const db = new Dexie(name) as VocabularyDatabase;
  db.version(DB_VERSION).stores({
    // `wordKey` is unique so the same word is never stored twice.
    vocabulary: 'id, &wordKey, word, createdAt, updatedAt, favorite, *tags',
  });
  return db;
}

export const db = createDatabase();
