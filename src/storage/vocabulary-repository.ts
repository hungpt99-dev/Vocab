import type {
  NewVocabularyEntry,
  VocabularyEntry,
  VocabularyPatch,
  VocabularyQuery,
} from '@/shared/types/vocabulary';
import { collapseWhitespace, isPhrase, normalizeTags, normalizeWord } from '@/shared/lib/text';
import { createId } from '@/shared/lib/id';
import { db as defaultDb, type VocabularyDatabase } from './database';

/**
 * Persistence boundary for vocabulary entries.
 * Callers never see Dexie types, so the storage engine stays swappable.
 */
export class VocabularyRepository {
  constructor(private readonly db: VocabularyDatabase = defaultDb) {}

  /**
   * Insert a new entry, or merge into the existing one when the same word was
   * already saved. Returns the stored entry either way.
   */
  async save(input: NewVocabularyEntry): Promise<VocabularyEntry> {
    const word = collapseWhitespace(input.word);
    if (!word) throw new Error('Cannot save an empty word');

    const wordKey = normalizeWord(word);
    const now = Date.now();
    const existing = await this.db.vocabulary.where('wordKey').equals(wordKey).first();

    if (existing) {
      const merged: VocabularyEntry = {
        ...existing,
        phrase: input.phrase ?? existing.phrase,
        sentence: input.sentence ? collapseWhitespace(input.sentence) : existing.sentence,
        sourceUrl: input.sourceUrl ?? existing.sourceUrl,
        sourceTitle: input.sourceTitle ?? existing.sourceTitle,
        note: input.note ?? existing.note,
        tags: normalizeTags([...existing.tags, ...(input.tags ?? [])]),
        favorite: input.favorite ?? existing.favorite,
        explanation: input.explanation ?? existing.explanation,
        updatedAt: now,
      };
      await this.db.vocabulary.put(merged);
      return merged;
    }

    const entry: VocabularyEntry = {
      id: createId(),
      word,
      wordKey,
      phrase: collapseWhitespace(input.phrase ?? (isPhrase(word) ? word : '')),
      sentence: collapseWhitespace(input.sentence ?? ''),
      sourceUrl: input.sourceUrl ?? '',
      sourceTitle: input.sourceTitle ?? '',
      note: input.note ?? '',
      tags: normalizeTags(input.tags ?? []),
      favorite: input.favorite ?? false,
      explanation: input.explanation ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.vocabulary.add(entry);
    return entry;
  }

  async get(id: string): Promise<VocabularyEntry | undefined> {
    return this.db.vocabulary.get(id);
  }

  async findByWord(word: string): Promise<VocabularyEntry | undefined> {
    return this.db.vocabulary.where('wordKey').equals(normalizeWord(word)).first();
  }

  async update(id: string, patch: VocabularyPatch): Promise<VocabularyEntry> {
    const existing = await this.db.vocabulary.get(id);
    if (!existing) throw new Error(`Vocabulary entry ${id} not found`);

    const next: VocabularyEntry = { ...existing, ...patch, updatedAt: Date.now() };
    if (patch.word !== undefined) {
      const word = collapseWhitespace(patch.word);
      if (!word) throw new Error('Cannot save an empty word');
      next.word = word;
      next.wordKey = normalizeWord(word);
    }
    if (patch.tags !== undefined) next.tags = normalizeTags(patch.tags);
    if (patch.sentence !== undefined) next.sentence = collapseWhitespace(patch.sentence);

    await this.db.vocabulary.put(next);
    return next;
  }

  async toggleFavorite(id: string): Promise<VocabularyEntry> {
    const existing = await this.db.vocabulary.get(id);
    if (!existing) throw new Error(`Vocabulary entry ${id} not found`);
    return this.update(id, { favorite: !existing.favorite });
  }

  async remove(id: string): Promise<void> {
    await this.db.vocabulary.delete(id);
  }

  async clear(): Promise<void> {
    await this.db.vocabulary.clear();
  }

  async count(): Promise<number> {
    return this.db.vocabulary.count();
  }

  /** List entries, applying search, filters, sorting and pagination in memory. */
  async list(query: VocabularyQuery = {}): Promise<VocabularyEntry[]> {
    const {
      search = '',
      favoritesOnly = false,
      tag = '',
      sortBy = 'createdAt',
      sortDirection = 'desc',
      limit,
      offset = 0,
    } = query;

    let entries = await this.db.vocabulary.toArray();

    if (favoritesOnly) entries = entries.filter((entry) => entry.favorite);
    if (tag) {
      const needle = normalizeWord(tag);
      entries = entries.filter((entry) => entry.tags.includes(needle));
    }
    const term = normalizeWord(search);
    if (term) {
      entries = entries.filter((entry) => matchesTerm(entry, term));
    }

    entries.sort((a, b) => {
      const result =
        sortBy === 'word' ? a.wordKey.localeCompare(b.wordKey) : a.createdAt - b.createdAt;
      return sortDirection === 'asc' ? result : -result;
    });

    const start = Math.max(0, offset);
    return limit === undefined ? entries.slice(start) : entries.slice(start, start + limit);
  }

  /** Distinct tags across all entries, alphabetically sorted. */
  async listTags(): Promise<string[]> {
    const entries = await this.db.vocabulary.toArray();
    return [...new Set(entries.flatMap((entry) => entry.tags))].sort();
  }

  /** Every stored word key — used by the content script to build its matcher. */
  async listWordKeys(): Promise<string[]> {
    const entries = await this.db.vocabulary.toArray();
    return entries.map((entry) => entry.wordKey);
  }

  async exportAll(): Promise<VocabularyEntry[]> {
    return this.list({ sortBy: 'createdAt', sortDirection: 'asc' });
  }

  /**
   * Bulk import entries.
   * `replace` wipes the store first; otherwise entries are merged by word key,
   * keeping the most recently updated version of each field set.
   */
  async importAll(
    entries: readonly VocabularyEntry[],
    mode: 'merge' | 'replace' = 'merge',
  ): Promise<{ imported: number; skipped: number }> {
    if (mode === 'replace') {
      await this.db.vocabulary.clear();
    }

    let imported = 0;
    let skipped = 0;
    for (const entry of entries) {
      const wordKey = normalizeWord(entry.word);
      if (!wordKey) {
        skipped += 1;
        continue;
      }
      const existing = await this.db.vocabulary.where('wordKey').equals(wordKey).first();
      if (existing && existing.updatedAt >= entry.updatedAt) {
        skipped += 1;
        continue;
      }
      const next: VocabularyEntry = {
        ...entry,
        id: existing?.id ?? entry.id ?? createId(),
        wordKey,
        tags: normalizeTags(entry.tags ?? []),
      };
      await this.db.vocabulary.put(next);
      imported += 1;
    }
    return { imported, skipped };
  }
}

function matchesTerm(entry: VocabularyEntry, term: string): boolean {
  return (
    entry.wordKey.includes(term) ||
    entry.phrase.toLowerCase().includes(term) ||
    entry.sentence.toLowerCase().includes(term) ||
    entry.note.toLowerCase().includes(term) ||
    entry.tags.some((tag) => tag.includes(term))
  );
}

export const vocabularyRepository = new VocabularyRepository();
