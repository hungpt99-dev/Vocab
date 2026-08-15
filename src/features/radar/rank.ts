import type { RadarCandidate, RankedCandidate, RadarRelevanceTier } from './types';
import { collapseWhitespace } from '@/shared/lib/text';

/** Minimum score a candidate must have to be shown to the user by default. */
export const MIN_DISPLAY_SCORE = 70;
/** Score at or above this is treated as "highly relevant" (🔥). */
export const HIGH_RELEVANCE_SCORE = 90;

/**
 * Normalize a candidate's surface form into a coarse "family" key used for
 * de-duplication and known-vocabulary filtering. This is intentionally a cheap,
 * deterministic heuristic (not a full lemmatizer): lowercase + collapse
 * whitespace + strip a leading article + strip common English inflection
 * suffixes (with a doubled-consonant repair so "running" → "run"). It collapses
 * run/runs/running and book/books so the same concept is not reported multiple
 * times, and it lines up well enough with the `lemma`/`normalizedForm` values
 * the vocabulary store already keeps for saved words (both sides are run through
 * the same function).
 */
export function normalizeFamilyKey(text: string): string {
  let t = collapseWhitespace(text).toLowerCase().trim();
  if (!t) return '';
  // Drop a leading determiner some models add ("a/the recommendation").
  t = t.replace(/^(a|an|the)\s+/, '');
  if (t.length <= 3) return t;

  if (t.endsWith('ies')) {
    t = t.slice(0, -3) + 'y';
  } else if (t.endsWith('ing')) {
    t = stripDoubledEnd(t.slice(0, -3));
  } else if (t.endsWith('ed')) {
    t = stripDoubledEnd(t.slice(0, -2));
  } else if (t.endsWith('es')) {
    t = t.slice(0, -2);
  } else if (t.endsWith('s') && !t.endsWith('ss')) {
    t = t.slice(0, -1);
  }
  return t;
}

/** After stripping -ing/-ed, repair a doubled final consonant (runn → run). */
function stripDoubledEnd(stem: string): string {
  if (stem.length > 1 && stem[stem.length - 1] === stem[stem.length - 2]) {
    return stem.slice(0, -1);
  }
  return stem;
}

function tierFor(score: number): RadarRelevanceTier {
  return score >= HIGH_RELEVANCE_SCORE ? 'high' : 'relevant';
}

export interface RankOptions {
  /** Families (normalized keys) the user already knows/saved — excluded. */
  knownFamilies?: ReadonlySet<string>;
  /** Minimum display score; defaults to {@link MIN_DISPLAY_SCORE}. */
  minScore?: number;
  /** Only surface members of this tier or above ('high' = high-tier only). */
  minTier?: RadarRelevanceTier;
}

/**
 * Merge candidates from multiple chunks into a deduplicated, ranked, personalized
 * list.
 *
 * Pipeline per candidate:
 *  1. Normalize to a `familyKey` (lemma-ish) and to a `key` (exact form).
 *  2. Drop it if its family is already in `knownFamilies` (the user knows it).
 *  3. Across chunks, keep the best score/context per family; prefer phrases over
 *     bare words when both represent the same concept.
 *  4. Blend the model's relevance score with a small novelty/context signal so
 *     that two equally-relevant items are ordered by usefulness, not by chance.
 *  5. Filter by `minScore`/`minTier`, sort descending, cap at `limit`.
 */
export function mergeAndRank(
  candidates: RadarCandidate[],
  limit = 5,
  options: RankOptions = {},
): RankedCandidate[] {
  const knownFamilies = options.knownFamilies ?? EMPTY_SET;
  const minScore = options.minScore ?? MIN_DISPLAY_SCORE;

  const byFamily = new Map<string, RankedCandidate>();

  for (const candidate of candidates) {
    const familyKey = normalizeFamilyKey(candidate.text);
    if (!familyKey) continue;
    // Personalization: never suggest something the user already has.
    if (knownFamilies.has(familyKey)) continue;

    const key = collapseWhitespace(candidate.text).toLowerCase();
    const effectiveScore = blendScore(candidate);

    const ranked: RankedCandidate = {
      ...candidate,
      key,
      familyKey,
      tier: tierFor(effectiveScore),
    };

    const existing = byFamily.get(familyKey);
    if (!existing) {
      byFamily.set(familyKey, ranked);
      continue;
    }
    // Merge duplicates: keep the stronger score and the richer context.
    if (effectiveScore > blendScore(existing)) {
      existing.score = candidate.score;
      existing.tier = tierFor(candidate.score);
    }
    if (!existing.context && ranked.context) existing.context = ranked.context;
    if (!existing.reason && ranked.reason) existing.reason = ranked.reason;
    if (ranked.type === 'phrase' && existing.type === 'word') existing.type = 'phrase';
    // Recompute the blended score on the merged record so ordering is stable.
    existing.tier = tierFor(blendScore(existing));
  }

  return [...byFamily.values()]
    .filter((c) => c.score >= minScore)
    .filter((c) => (options.minTier ? c.tier === options.minTier : true))
    .sort((a, b) => blendScore(b) - blendScore(a))
    .slice(0, limit);
}

/**
 * Blend the model's relevance score (0–100) with a light novelty/context signal.
 * The model score dominates; context presence adds a small bump because a
 * candidate shown with its real sentence is far more actionable than an orphan.
 * Kept deliberately small so ranking is driven by learning value, not noise.
 */
function blendScore(candidate: RadarCandidate): number {
  let score = candidate.score;
  if (candidate.context && candidate.context.trim()) score += CONTEXT_BONUS;
  return Math.min(100, score);
}

const CONTEXT_BONUS = 3;
const EMPTY_SET: ReadonlySet<string> = new Set();
