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
  /** Provider id that generated this explanation. */
  provider: string;
  /** Model identifier used, when reported. */
  model: string;
  generatedAt: number;
}

/** A single saved vocabulary item. */
export interface VocabularyEntry {
  id: string;
  /** The saved word or phrase as the user selected it. */
  word: string;
  /** Normalised lookup key: lowercase, whitespace-collapsed. */
  wordKey: string;
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
