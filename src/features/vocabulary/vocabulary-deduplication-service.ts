import type { NormalizedWord } from './types';

/** Outcome of attempting to save a normalized word. */
export type SaveDecision =
  | { kind: 'saved'; entry: { userId: string; familyId: string } }
  | { kind: 'already-saved'; existingFamilyId: string };

/**
 * Resolves whether a normalized word should be saved or is already part of the
 * user's saved vocabulary.
 *
 * The deduplication key is `(userId, familyId)`: two surface forms that resolve
 * to the same word family (e.g. `book` and `books`, or `beautiful` and
 * `beautifully`) map to the same familyId and therefore the same vocabulary
 * concept for that user. A different user may still save the same family.
 *
 * This service is a pure policy layer: it only decides *whether* to save, never
 * how to persist. The actual uniqueness guarantee comes from a database-level
 * constraint on `(userId, familyId)` (see `storage/database.ts`), which protects
 * against concurrent saves creating duplicates that a read-then-write check
 * alone could not.
 */
export interface VocabularyDeduplicationService {
  /** Returns true when `familyId` is already saved for `userId`. */
  isFamilySaved(userId: string, familyId: string): Promise<boolean>;
  /**
   * Decide the save outcome for a normalized word. Implementations should
   * combine the read-check with a database unique constraint so concurrent
   * requests cannot both pass the check and insert.
   */
  decide(userId: string, normalized: NormalizedWord): Promise<SaveDecision>;
}
