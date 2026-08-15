import type { VocabularyEntry } from '@/shared/types/vocabulary';
import type { RadarCandidateInput, RadarEntry, RadarEntryView } from './types';
import { createId } from '@/shared/lib/id';
import { getUserId } from '@/shared/lib/user-id';
import { collapseWhitespace, isPhrase, normalizeWord } from '@/shared/lib/text';
import { db as defaultDb, type VocabularyDatabase } from '@/storage/database';
import { vocabularyRepository } from '@/storage/vocabulary-repository';

/**
 * Persistence + rules for Vocab Radar candidates.
 *
 * Radar entries are GENERATED from saved vocabulary (see radar-generator). This
 * store owns the lifecycle rules that keep Radar and Saved Vocabulary disjoint:
 *
 *  - No duplicate Radar entries: `wordKey` is unique; a second generation from
 *    another source word merges into the existing entry's `sourceIds`.
 *  - A candidate that is ALREADY a saved word is never added to Radar.
 *  - A candidate identical to its own source saved word is never added.
 *  - When a Radar word is saved, `removeByWordKey` deletes it from Radar.
 *  - When a source saved word is deleted, `dropSource` removes that source; the
 *    Radar entry is deleted once it has no sources left.
 */
export class RadarStore {
  constructor(
    private readonly db: VocabularyDatabase = defaultDb,
    private readonly resolveUserId: () => Promise<string> = getUserId,
    /** Decides whether a wordKey is already a saved vocabulary item. */
    private readonly isSaved: (wordKey: string) => Promise<boolean> = (key) =>
      vocabularyRepository.findByWord(key).then((e) => Boolean(e)),
  ) {}

  /**
   * Persist generation output for one source saved word.
   * Returns the radar entries actually created or merged (excludes ones that
   * were skipped because they are already saved or duplicate the source).
   */
  async addCandidates(
    source: VocabularyEntry,
    candidates: readonly RadarCandidateInput[],
  ): Promise<RadarEntry[]> {
    const userId = await this.resolveUserId();
    const sourceKey = source.wordKey;
    const sourceId = source.id;
    const now = Date.now();
    const created: RadarEntry[] = [];

    // De-dupe within this batch first.
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const word = collapseWhitespace(candidate.word);
      if (!word) continue;
      const wordKey = normalizeWord(word);
      if (!wordKey) continue;
      if (wordKey === sourceKey) continue; // never re-add the source word itself
      if (seen.has(wordKey)) continue;
      seen.add(wordKey);

      // Skip if already a saved vocabulary item (Radar and Saved never overlap).
      if (await this.isSaved(wordKey)) continue;

      const existing = await this.db.radar.where('wordKey').equals(wordKey).first();
      if (existing) {
        if (!existing.sourceIds.includes(sourceId)) {
          const merged: RadarEntry = {
            ...existing,
            sourceIds: [...existing.sourceIds, sourceId],
            updatedAt: now,
          };
          await this.db.radar.put(merged);
        }
        continue;
      }

      const entry: RadarEntry = {
        id: createId(),
        word,
        wordKey,
        normalizedForm: wordKey,
        lemma: wordKey,
        familyId: wordKey,
        phrase: isPhrase(word) ? word : '',
        userId,
        sourceIds: [sourceId],
        relationship: candidate.relationship,
        reason: candidate.reason,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.radar.add(entry);
      created.push(entry);
    }
    return created;
  }

  /** Remove a Radar entry by its lookup key (e.g. when it becomes Saved). */
  async removeByWordKey(wordKey: string): Promise<void> {
    const key = normalizeWord(wordKey);
    if (!key) return;
    await this.db.radar.where('wordKey').equals(key).delete();
  }

  /** Remove saved-word sources; delete entries left with no sources. */
  async dropSource(sourceId: string): Promise<void> {
    const rows = await this.db.radar.where('sourceId').equals(sourceId).toArray();
    for (const row of rows) {
      const remaining = row.sourceIds.filter((id) => id !== sourceId);
      if (remaining.length === 0) {
        await this.db.radar.delete(row.id);
      } else {
        await this.db.radar.put({ ...row, sourceIds: remaining, updatedAt: Date.now() });
      }
    }
  }

  async listAll(): Promise<RadarEntry[]> {
    const rows = await this.db.radar.toArray();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }

  /** List entries enriched with their source saved-word display labels. */
  async listViews(): Promise<RadarEntryView[]> {
    const [rows, saved] = await Promise.all([
      this.listAll(),
      vocabularyRepository.list({ sortBy: 'word', sortDirection: 'asc' }),
    ]);
    const byId = new Map(saved.map((e) => [e.id, e]));
    return rows.map((row) => ({
      ...row,
      sourceWords: row.sourceIds
        .map((id) => byId.get(id)?.word)
        .filter((w): w is string => Boolean(w)),
    }));
  }

  async findByWordKey(wordKey: string): Promise<RadarEntry | undefined> {
    const key = normalizeWord(wordKey);
    if (!key) return undefined;
    return this.db.radar.where('wordKey').equals(key).first();
  }

  async count(): Promise<number> {
    return this.db.radar.count();
  }

  async clear(): Promise<void> {
    await this.db.radar.clear();
  }
}

export const radarStore = new RadarStore();
