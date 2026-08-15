/** A single vocabulary item the AI proposes as relevant to the user's Radar goal. */
export interface RadarCandidate {
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
export interface RadarAnalysisResponse {
  candidates: RadarCandidate[];
}

/** A candidate after ranking, with derived keys/tier for the UI. */
export interface RankedCandidate extends RadarCandidate {
  /** Normalised key used for deduplication (lowercased, whitespace-collapsed). */
  key: string;
  /** Coarse lemma/family key used for de-duplication and known-vocab filtering. */
  familyKey: string;
  /** UI relevance tier derived from the (blended) score. */
  tier: 'high' | 'relevant';
}

export type RadarRelevanceTier = 'high' | 'relevant';
