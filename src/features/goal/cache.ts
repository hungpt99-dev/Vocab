/** Local cache for goal-page analyses.
 *
 * Key = normalised URL + active goal id + content hash, so a repeat scan of the
 * same page with the same goal reuses the result without another AI call.
 * Invalidation is implicit: changing the goal, the page content, or the URL
 * produces a different key and therefore a cache miss. Credentials are never
 * cached.
 */
export interface GoalAnalysisCacheEntry {
  candidates: import('./types').GoalCandidate[];
  expiresAt: number;
}

export class GoalAnalysisCache {
  private readonly store = new Map<string, GoalAnalysisCacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = 1000 * 60 * 60 * 24) {
    this.ttlMs = ttlMs;
  }

  /** Cheap, non-cryptographic content hash (FNV-1a) — enough to detect change. */
  static contentHash(text: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  static key(url: string, goalId: string, content: string): string {
    const norm = url.trim().toLowerCase().replace(/[#?].*$/, '');
    return `${norm}|${goalId}|${GoalAnalysisCache.contentHash(content)}`;
  }

  get(url: string, goalId: string, content: string): import('./types').GoalCandidate[] | null {
    const key = GoalAnalysisCache.key(url, goalId, content);
    const entry = this.store.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.candidates;
    this.store.delete(key);
    return null;
  }

  set(
    url: string,
    goalId: string,
    content: string,
    candidates: import('./types').GoalCandidate[],
  ): void {
    const key = GoalAnalysisCache.key(url, goalId, content);
    this.store.set(key, { candidates, expiresAt: Date.now() + this.ttlMs });
  }

  /** Drop all cached analyses (e.g. on demand or when invalidating). */
  clear(): void {
    this.store.clear();
  }
}
