import Dexie, { type EntityTable } from 'dexie';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

export const DB_NAME = 'ai-vocabulary-saver';
export const DB_VERSION = 2;

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

export interface GoalRecord {
  id: string;
  text: string;
  domains?: string[];
  topics?: string[];
  situations?: string[];
  createdAt: number;
  updatedAt: number;
}

export type VocabularyDatabase = Dexie & {
  vocabulary: EntityTable<VocabularyEntry, 'id'>;
  review: EntityTable<ReviewRecord, 'id'>;
  goals: EntityTable<GoalRecord, 'id'>;
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
  // VOC-132: Vocabulary Goal Mode goals.
  db.version(3).stores({
    goals: 'id, updatedAt, createdAt',
  });
  return db;
}

export const db = createDatabase();
