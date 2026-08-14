import type {
  NewVocabularyEntry,
  VocabularyEntry,
  VocabularyPatch,
  VocabularyQuery,
} from '@/shared/types/vocabulary';
import { collapseWhitespace, isPhrase, normalizeTags, normalizeWord } from '@/shared/lib/text';
import { createId } from '@/shared/lib/id';
import { getUserId } from '@/shared/lib/user-id';
import { db as defaultDb, type VocabularyDatabase } from './database';
import type { NormalizedWord } from '@/features/vocabulary/types';
import type { VocabularyNormalizationService } from '@/features/vocabulary/vocabulary-normalization-service';
import { vocabularyNormalizationService } from '@/features/vocabulary/vocabulary-normalization-service';

/**
 * Persistence boundary for vocabulary entries.
 * Callers never see Dexie types, so the storage engine stays swappable.
 */
export class VocabularyRepository {
  constructor(
    private readonly db: VocabularyDatabase = defaultDb,
    private readonly normalize: VocabularyNormalizationService = vocabularyNormalizationService,
    private readonly resolveUserId: () => Promise<string> = getUserId,
  ) {}

  /**
   * Insert a new entry, or merge into the existing one when the same word was
   * already saved. Returns the stored entry either way.
   *
   * The save runs the word through the normalization pipeline (normalize →
   * singularize → lemmatize → word-family resolve) so the stored concept carries
   * its canonical `lemma` and `familyId`. Duplicate concepts are prevented two
   * ways: a read check against `(userId, familyId)`, and a database-level unique
   * compound index that turns a concurrent second insert into a constraint
   * violation rather than a duplicate row.
   */
  /**
   * Merge a new save into an existing word-family entry.
   *
   * The canonical concept fields (`lemma`, `familyId`, `partOfSpeech`,
   * `normalizedForm`) always adopt the latest linguistic analysis so the family
   * stays internally consistent. The *display* surface fields are the trap: when
   * the incoming word differs from the existing one's surface form (e.g. the
   * user highlighted "apple" on the page but "apples" was already saved — both
   * resolve to the same family), the latest save must win the visible `word`,
   * `surfaceForm` and `wordKey`. Otherwise the popup would report "Saved apple"
   * while the library keeps showing "apples", which reads as "it saved a
   * different word". When the incoming word is the same as the existing surface
   * form we keep the original (re-saving the same word must not churn it).
   */
  async save(input: NewVocabularyEntry): Promise<VocabularyEntry> {
    const word = collapseWhitespace(input.word);
    if (!word) throw new Error('Cannot save an empty word');

    const userId = await this.resolveUserId();
    const normalized: NormalizedWord = await this.normalize.normalize(word, input.sentence);

    // Set when a concurrent save already won the unique (userId, familyId) slot.
    let concurrencyMerged: VocabularyEntry | undefined;

    const now = Date.now();
    const existing = await this.findByFamily(userId, normalized.familyId);

    if (existing) {
      const merged = mergeIntoExisting(existing, input, normalized, now);
      await this.db.vocabulary.put(merged);
      return merged;
    }

    const entry: VocabularyEntry = {
      id: createId(),
      word,
      wordKey: normalizeWord(word),
      userId,
      surfaceForm: normalized.surfaceForm,
      normalizedForm: normalized.normalizedForm,
      lemma: normalized.lemma,
      familyId: normalized.familyId,
      partOfSpeech: normalized.partOfSpeech,
      phrase: collapseWhitespace(input.phrase ?? (isPhrase(word) ? word : '')),
      sentence: collapseWhitespace(input.sentence ?? ''),
      sourceUrl: input.sourceUrl ?? '',
      sourceTitle: input.sourceTitle ?? '',
      note: input.note ?? '',
      tags: normalizeTags(input.tags ?? []),
      favorite: input.favorite ?? false,
      sourceLanguage: input.sourceLanguage ?? '',
      explanation: input.explanation ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.vocabulary.add(entry).catch(async (error: unknown) => {
      // The unique (userId, familyId) index makes a concurrent second save of
      // the same family a constraint violation rather than a duplicate row.
      // Treat that as "already saved": re-read the surviving row and return it.
      const isConstraint =
        error instanceof DOMException
          ? error.name === 'ConstraintError'
          : (error as { name?: string })?.name === 'ConstraintError';
      if (isConstraint) {
        const existing = await this.findByFamily(userId, normalized.familyId);
        if (existing) {
          // Merge the new encounter's fields into the surviving entry so the
          // caller still gets an up-to-date record.
          const merged = mergeIntoExisting(existing, input, normalized, now);
          await this.db.vocabulary.put(merged);
          concurrencyMerged = merged;
          return;
        }
      }
      throw error;
    });
    if (concurrencyMerged) return concurrencyMerged;
    return entry;
  }

  async get(id: string): Promise<VocabularyEntry | undefined> {
    return this.db.vocabulary.get(id);
  }

  async findByWord(word: string): Promise<VocabularyEntry | undefined> {
    return this.db.vocabulary.where('wordKey').equals(normalizeWord(word)).first();
  }

  /** Find an existing saved concept for this user by its word-family identity. */
  async findByFamily(userId: string, familyId: string): Promise<VocabularyEntry | undefined> {
    if (!userId || !familyId) return undefined;
    return this.db.vocabulary
      .where('[userId+familyId]')
      .equals([userId, familyId])
      .first();
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
      // Re-run the pipeline so the canonical lemma/family follow the new word.
      const normalized = await this.normalize.normalize(word, next.sentence);
      next.surfaceForm = normalized.surfaceForm;
      next.normalizedForm = normalized.normalizedForm;
      next.lemma = normalized.lemma;
      next.familyId = normalized.familyId;
      next.partOfSpeech = normalized.partOfSpeech;
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

  /**
   * Lightweight progress snapshot for the popup: total saved words, words added
   * today (local time), and a daily-save streak. The streak counts consecutive
   * calendar days (ending today or yesterday) that each had at least one save.
   */
  async stats(): Promise<{ total: number; addedToday: number; streak: number }> {
    const entries = await this.db.vocabulary.toArray();
    const total = entries.length;
    if (total === 0) return { total: 0, addedToday: 0, streak: 0 };

    const dayKey = (ts: number): string => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    };
    const todayKey = dayKey(Date.now());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = dayKey(yesterday.getTime());

    const daysWithSaves = new Set(entries.map((entry) => dayKey(entry.createdAt)));
    const addedToday = entries.filter((entry) => dayKey(entry.createdAt) === todayKey).length;

    // Walk backwards from today (or yesterday) counting consecutive active days.
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    // If nothing was saved today, the streak still counts if yesterday was active.
    if (!daysWithSaves.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
    while (daysWithSaves.has(dayKey(cursor.getTime()))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    // A streak that has no save today and none yesterday has effectively lapsed.
    if (streak > 0 && !daysWithSaves.has(todayKey) && !daysWithSaves.has(yesterdayKey)) {
      streak = 0;
    }
    return { total, addedToday, streak };
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

/**
 * Merge a new save into an existing word-family entry.
 *
 * The canonical concept fields (`lemma`, `familyId`, `partOfSpeech`,
 * `normalizedForm`) always adopt the latest linguistic analysis so the family
 * stays internally consistent. The *display* surface fields are the trap: when
 * the incoming word differs from the existing one's surface form (e.g. the user
 * highlighted "apple" on the page but "apples" was already saved — both resolve
 * to the same family), the latest save must win the visible `word`,
 * `surfaceForm` and `wordKey`. Otherwise the popup would report "Saved apple"
 * while the library keeps showing "apples", which reads as "it saved a
 * different word". When the incoming word is the same as the existing surface
 * form we keep the original (re-saving the same word must not churn it).
 */
function mergeIntoExisting(
  existing: VocabularyEntry,
  input: NewVocabularyEntry,
  normalized: NormalizedWord,
  now: number,
): VocabularyEntry {
  const incomingWord = collapseWhitespace(input.word);
  // Treat two saves as "the same word" when their normalized forms match
  // (case-insensitive, punctuation-stripped) — e.g. "Apples" vs "apples".
  // Only when the incoming normalized form is genuinely different from the
  // existing one (e.g. the highlighted "apple" vs the saved "apples") does the
  // latest save take over the visible surface fields. This avoids both the
  // original bug (wrong word shown) and needless churn on a same-word re-save.
  const isNewSurfaceForm = normalized.normalizedForm !== existing.wordKey;
  const displayWord = isNewSurfaceForm ? incomingWord : existing.word;
  const displaySurfaceForm = isNewSurfaceForm ? normalized.surfaceForm : existing.surfaceForm;

  return {
    ...existing,
    word: displayWord,
    wordKey: normalizeWord(displayWord),
    surfaceForm: displaySurfaceForm,
    phrase: input.phrase ?? existing.phrase,
    sentence: input.sentence ? collapseWhitespace(input.sentence) : existing.sentence,
    sourceUrl: input.sourceUrl ?? existing.sourceUrl,
    sourceTitle: input.sourceTitle ?? existing.sourceTitle,
    note: input.note ?? existing.note,
    tags: normalizeTags([...existing.tags, ...(input.tags ?? [])]),
    favorite: input.favorite ?? existing.favorite,
    sourceLanguage: input.sourceLanguage ?? existing.sourceLanguage,
    // Canonical concept fields adopt the latest analysis (the family identity
    // never changes on merge, but the lemma/POS may refine).
    normalizedForm: normalized.normalizedForm,
    lemma: normalized.lemma,
    familyId: normalized.familyId,
    partOfSpeech: normalized.partOfSpeech,
    explanation: input.explanation ?? existing.explanation,
    updatedAt: now,
  };
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
