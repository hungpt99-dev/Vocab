import type { VocabularyGoal } from '@/features/goal/types';
import { createId } from '@/shared/lib/id';
import { db as defaultDb, type VocabularyDatabase } from './database';

interface NewGoal {
  text: string;
  domains?: string[];
  topics?: string[];
  situations?: string[];
}

/**
 * Persistence boundary for Vocabulary Goals.
 * Mirrors VocabularyRepository: callers never see Dexie types, and the store is
 * swappable. Goals are independent of vocabulary entries; the active-goal pointer
 * lives in Settings so it can be read cheaply by every surface.
 */
export class GoalRepository {
  constructor(private readonly db: VocabularyDatabase = defaultDb) {}

  async create(input: NewGoal): Promise<VocabularyGoal> {
    const text = input.text.trim();
    if (!text) throw new Error('Cannot save an empty goal');

    const now = Date.now();
    const goal: VocabularyGoal = {
      id: createId(),
      text,
      domains: input.domains,
      topics: input.topics,
      situations: input.situations,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.goals.add(goal);
    return goal;
  }

  async update(id: string, patch: Partial<NewGoal>): Promise<VocabularyGoal> {
    const existing = await this.db.goals.get(id);
    if (!existing) throw new Error(`Goal ${id} not found`);

    const next: VocabularyGoal = {
      ...existing,
      ...patch,
      text: patch.text !== undefined ? patch.text.trim() : existing.text,
      updatedAt: Date.now(),
    };
    if (!next.text) throw new Error('Cannot save an empty goal');
    await this.db.goals.put(next);
    return next;
  }

  async remove(id: string): Promise<void> {
    await this.db.goals.delete(id);
  }

  async get(id: string): Promise<VocabularyGoal | undefined> {
    return this.db.goals.get(id);
  }

  /** All goals, newest first. */
  async list(): Promise<VocabularyGoal[]> {
    const all = await this.db.goals.toArray();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async clear(): Promise<void> {
    await this.db.goals.clear();
  }
}

export const goalRepository = new GoalRepository();
