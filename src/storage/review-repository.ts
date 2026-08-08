import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { db as defaultDb, type VocabularyDatabase } from './database';
import { nextSchedule, SRS_DEFAULTS, type SrsGrade } from '@/shared/lib/srs';

export interface DueCard {
  id: string;
  word: string;
  wordKey: string;
  /** The saved entry the card reviews, for showing meaning/context on flip. */
  entry?: VocabularyEntry;
}

export interface ReviewStats {
  total: number;
  due: number;
  learned: number;
}

/**
 * Persistence for the spaced-repetition review queue. Each saved vocabulary entry
 * gets one review card; the queue surfaces due cards and records grading results
 * using the SM-2 scheduler in `shared/lib/srs`.
 */
export class ReviewRepository {
  constructor(private readonly db: VocabularyDatabase = defaultDb) {}

  /** Create a review card for an entry the first time it is saved. */
  async ensureScheduled(entry: VocabularyEntry): Promise<void> {
    const existing = await this.db.review.get(entry.id);
    if (existing) return;
    const now = Date.now();
    await this.db.review.put({
      id: entry.id,
      wordKey: entry.wordKey,
      word: entry.word,
      ease: SRS_DEFAULTS.ease,
      intervalDays: SRS_DEFAULTS.intervalDays,
      reps: SRS_DEFAULTS.reps,
      dueAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Cards whose due date has passed, soonest-due first. */
  async dueCards(limit = 20, now: number = Date.now()): Promise<DueCard[]> {
    const records = await this.db.review.where('dueAt').belowOrEqual(now).toArray();
    records.sort((a, b) => a.dueAt - b.dueAt);
    const sliced = records.slice(0, limit);
    const cards: DueCard[] = [];
    for (const record of sliced) {
      const entry = await this.db.vocabulary.get(record.id);
      cards.push({ id: record.id, wordKey: record.wordKey, word: record.word, entry });
    }
    return cards;
  }

  async dueCount(now: number = Date.now()): Promise<number> {
    return this.db.review.where('dueAt').belowOrEqual(now).count();
  }

  async stats(now: number = Date.now()): Promise<ReviewStats> {
    const all = await this.db.review.toArray();
    return {
      total: all.length,
      due: all.filter((r) => r.dueAt <= now).length,
      learned: all.filter((r) => r.reps > 0).length,
    };
  }

  /** Apply a grade to a card and persist the next schedule. */
  async recordGrade(id: string, grade: SrsGrade, now: number = Date.now()): Promise<void> {
    const record = await this.db.review.get(id);
    if (!record) return;
    const next = nextSchedule(
      { ease: record.ease, intervalDays: record.intervalDays, reps: record.reps },
      grade,
      now,
    );
    await this.db.review.update(id, {
      ease: next.ease,
      intervalDays: next.intervalDays,
      reps: next.reps,
      dueAt: next.dueAt,
      updatedAt: now,
    });
  }

  /** Remove a card when its vocabulary entry is deleted. */
  async remove(id: string): Promise<void> {
    await this.db.review.delete(id);
  }
}

export const reviewRepository = new ReviewRepository();
