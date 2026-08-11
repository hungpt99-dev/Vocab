/** A user's vocabulary learning goal. The natural-language `text` is the source
 * of truth; the structured fields are optional AI-extracted hints that help the
 * AI find relevant vocabulary but are never required for the feature to work. */
export interface VocabularyGoal {
  id: string;
  /** Original goal text entered by the user, e.g. "Improve English for backend engineering". */
  text: string;
  /** Optional AI-extracted domains (e.g. "backend engineering"). */
  domains?: string[];
  /** Optional AI-extracted topics (e.g. "system design"). */
  topics?: string[];
  /** Optional AI-extracted situations (e.g. "code reviews"). */
  situations?: string[];
  createdAt: number;
  updatedAt: number;
}

/** A single vocabulary item the AI proposes for a goal. */
export interface GoalCandidate {
  /** The surface form exactly as it appears in the page text. */
  text: string;
  /** 'word' or 'phrase'. */
  type: 'word' | 'phrase';
  /** Relevance score 0–100. */
  score: number;
  /** Why this item is useful for the goal. */
  reason: string;
  /** A real sentence from the page containing the item, when available. */
  context?: string;
}

/** Raw AI response shape we ask the model to return. */
export interface GoalAnalysisResponse {
  candidates: GoalCandidate[];
}

/** A candidate after ranking, with a derived relevance tier for the UI. */
export interface RankedCandidate extends GoalCandidate {
  /** Normalised key used for deduplication (lowercased, whitespace-collapsed). */
  key: string;
  /** UI relevance tier derived from the score. */
  tier: 'high' | 'relevant';
}

export type GoalRelevanceTier = 'high' | 'relevant';
