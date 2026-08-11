import type { RadarCandidate, RankedCandidate, RadarRelevanceTier } from './types';
import { collapseWhitespace } from '@/shared/lib/text';

/** Minimum score a candidate must have to be shown to the user by default. */
export const MIN_DISPLAY_SCORE = 70;
/** Score at or above this is treated as "highly relevant" (🔥). */
export const HIGH_RELEVANCE_SCORE = 90;

export function normalizeCandidateKey(text: string): string {
  return collapseWhitespace(text).toLowerCase();
}

function tierFor(score: number): RadarRelevanceTier {
  return score >= HIGH_RELEVANCE_SCORE ? 'high' : 'relevant';
}

/**
 * Merge candidates from multiple chunks into a deduplicated, ranked list.
 * - Normalises text for deduplication (lowercase, collapsed whitespace).
 * - Keeps the highest score among duplicates; preserves the best context/reason.
 * - Sorts descending by score.
 * - Returns at most `limit` candidates (default 5) scoring >= MIN_DISPLAY_SCORE.
 */
export function mergeAndRank(
  candidates: RadarCandidate[],
  limit = 5,
): RankedCandidate[] {
  const byKey = new Map<string, RankedCandidate>();

  for (const candidate of candidates) {
    const key = normalizeCandidateKey(candidate.text);
    const ranked: RankedCandidate = {
      ...candidate,
      key,
      tier: tierFor(candidate.score),
    };

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, ranked);
      continue;
    }
    // Keep the higher score; prefer a real context and a non-empty reason.
    if (ranked.score > existing.score) {
      existing.score = ranked.score;
      existing.tier = tierFor(ranked.score);
    }
    if (!existing.context && ranked.context) existing.context = ranked.context;
    if (!existing.reason && ranked.reason) existing.reason = ranked.reason;
    if (ranked.type === 'phrase' && existing.type === 'word') existing.type = 'phrase';
  }

  return [...byKey.values()]
    .filter((c) => c.score >= MIN_DISPLAY_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
