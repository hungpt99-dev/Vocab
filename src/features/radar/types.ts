/**
 * Data model for Vocab Radar — a personalized vocabulary-candidate system.
 *
 * Radar is NOT an AI search/discovery tool. Radar words are generated from the
 * user's own saved & enriched vocabulary: when a word is enriched, the AI
 * proposes related vocabulary, and those candidates become Radar entries, each
 * remembering which saved word(s) generated it.
 *
 * A word is NEVER simultaneously a Radar candidate and a Saved Vocabulary item.
 * Saving a Radar word moves it to Saved Vocabulary and removes it from Radar.
 */

/** How a Radar candidate relates to its source saved word. */
export type RadarRelationship =
  | 'synonym'
  | 'antonym'
  | 'hyponym'
  | 'hypernym'
  | 'collocation'
  | 'phrase'
  | 'form'
  | 'related';

/** Raw candidate returned by the Radar generation AI step, pre-normalization. */
export interface RadarCandidateInput {
  /** Surface form of the related word/phrase as proposed by the model. */
  word: string;
  /** Relationship to the source saved word. */
  relationship: RadarRelationship;
  /** One short sentence on why it is related / useful. */
  reason: string;
}

/** A persisted Radar entry (one generated candidate). */
export interface RadarEntry {
  id: string;
  /** Display form, preserved verbatim (e.g. `BOOKS`, `bear the brunt of`). */
  word: string;
  /** Lookup key: lowercased, whitespace-collapsed (from @/shared/lib/text). */
  wordKey: string;
  /** Language-agnostic text-normalized form. */
  normalizedForm: string;
  /** Canonical lemma when the model produced one (best-effort). */
  lemma: string;
  /** Word-family identity (best-effort; falls back to wordKey). */
  familyId: string;
  /** True phrase (multi-word) vs single word. */
  phrase: string;
  /** User id this candidate belongs to (mirrors vocabulary scoping). */
  userId: string;
  /** Saved-vocabulary entry ids that generated this candidate. */
  sourceIds: string[];
  /** Relationship to the (primary) source saved word. */
  relationship: RadarRelationship;
  /** Human-readable reason it was proposed. */
  reason: string;
  createdAt: number;
  updatedAt: number;
}

/** A Radar entry augmented with its source saved-word display labels, for the UI. */
export interface RadarEntryView extends RadarEntry {
  /** Display words of the source saved entries (e.g. ['mitigate', 'reduce']). */
  sourceWords: string[];
}
