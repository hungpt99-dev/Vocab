/** Structured explanation produced by an AI provider. */
export interface Explanation {
  meaning: string;
  simpleExplanation: string;
  /** Translation of the word into the user's configured target language. */
  translation: string;
  examples: string[];
  synonyms: string[];
  /** Words with the opposite meaning. */
  antonyms: string[];
  /** Words related in meaning or usage (hypernyms, hyponyms, variants). */
  relatedWords: string[];
  pronunciation: string;
  collocations: string[];
  /** Brief grammatical notes: part of speech, countability, irregular forms. */
  grammar: string;
  /** Part of speech, e.g. "noun". Populated for word-level explanations. */
  partOfSpeech?: string;
  /** How a phrase is used: register, typical contexts. Populated for phrases. */
  usage?: string;
  /** Plain-language gist of a sentence. Populated for sentence explanations. */
  summary?: string;
  /** Words in a sentence a learner may not know, each rendered "word: gloss". */
  difficultVocabulary?: string[];
  /** Register (formal/informal/neutral) and typical contexts. */
  register?: string;
  /** Short etymology / word origin. */
  etymology?: string;
  /** A few related phrases or fixed expressions. */
  relatedPhrases?: string[];
  /** Structured X-Ray Reading analysis; present only for the 'xray' kind. */
  xray?: import('./xray').XRayReadingResult;
  /** Provider id that generated this explanation. */
  provider: string;
  /** Model identifier used, when reported. */
  model: string;
  generatedAt: number;
}

/** A single saved vocabulary item. */
export interface VocabularyEntry {
  id: string;
  /** The saved word or phrase as the user selected it (preserved verbatim). */
  word: string;
  /** Normalised lookup key: lowercase, whitespace-collapsed. */
  wordKey: string;
  /**
   * Identity of the user who saved this entry. Scopes the vocabulary concept so
   * two users can each save the same word family independently. For this
   * local-first extension the owner is a stable per-install id.
   */
  userId: string;
  /**
   * The exact surface form the user encountered (e.g. `BOOKS`, `running`).
   * Preserved verbatim — never overwritten by the canonical lemma — so the UI
   * can show "you encountered: books".
   */
  surfaceForm: string;
  /** Language-agnostic text-normalized form (lowercase, unicode-collapsed). */
  normalizedForm: string;
  /** Canonical lemma produced by the linguistic pipeline (e.g. `book`, `run`). */
  lemma: string;
  /** Word-family identity (the vocabulary concept). Shared by inflections and
   *  transparently-related derivations (e.g. `beautiful`/`beautifully`). */
  familyId: string;
  /** Best-effort part of speech decided during linguistic analysis. */
  partOfSpeech?: string;
  /** Larger phrase the word belongs to, when the selection was multi-word. */
  phrase: string;
  /** Sentence surrounding the selection on the source page. */
  sentence: string;
  sourceUrl: string;
  sourceTitle: string;
  note: string;
  tags: string[];
  favorite: boolean;
  /** Detected language of the word/phrase, when known (BCP-47-ish label). */
  sourceLanguage: string;
  explanation: Explanation | null;
  createdAt: number;
  updatedAt: number;
}

/** Fields a caller may supply when saving a new entry. */
export interface NewVocabularyEntry {
  word: string;
  phrase?: string;
  sentence?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  note?: string;
  tags?: string[];
  favorite?: boolean;
  /** Detected source language; defaults to '' and is filled by the caller when known. */
  sourceLanguage?: string;
  explanation?: Explanation | null;
}

/** Fields that may be patched on an existing entry. */
export type VocabularyPatch = Partial<
  Pick<
    VocabularyEntry,
    | 'word'
    | 'phrase'
    | 'sentence'
    | 'sourceUrl'
    | 'sourceTitle'
    | 'note'
    | 'tags'
    | 'favorite'
    | 'sourceLanguage'
    | 'explanation'
  >
>;

export interface VocabularyQuery {
  /** Free-text term matched against word, sentence, note and tags. */
  search?: string;
  favoritesOnly?: boolean;
  tag?: string;
  sortBy?: 'createdAt' | 'word';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
