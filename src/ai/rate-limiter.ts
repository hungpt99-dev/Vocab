/**
 * A small token-bucket rate limiter used to avoid hammering an AI provider with
 * bursts of concurrent requests (e.g. auto-explain firing on several saves).
 *
 * It is intentionally dependency-free and supports a pluggable clock so tests
 * can advance time deterministically. It never rejects a request outright — it
 * waits until capacity is available — because the extension is user-driven and
 * a paused call is preferable to a dropped one.
 */
export interface RateLimiter {
  /** Resolves once a permit is available. Honours an optional abort signal. */
  acquire(signal?: AbortSignal): Promise<void>;
}

export interface RateLimiterOptions {
  /** Tokens replenished per window. */
  maxRequests: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

interface Bucket {
  tokens: number;
  // Timestamp (ms) at which the bucket next refills by one token.
  nextRefill: number;
}

/**
 * Rate limiter used ONLY for bilingual reading-mode translation/alignment.
 * Translation already batches ~16 paragraphs into a single provider call, so it
 * naturally issues far fewer requests than word-level explain; it also needs to
 * keep first-paint fast on long pages (many chunks in flight). We therefore give
 * it a generous standalone allowance rather than sharing the conservative
 * explanation limiter, which would serialize the chunks 2s apart and stall the
 * first screenful. Tunable: raise/lower TRANSLATION_RATE_LIMIT per provider.
 */
export const TRANSLATION_RATE_LIMIT = { maxRequests: 30, windowMs: 10_000 };
export const translationRateLimiter: RateLimiter = createRateLimiter(TRANSLATION_RATE_LIMIT);

/**
 * The single rate limiter shared by explanation-style capabilities (auto-explain,
 * enrichment) so concurrent requests there do not burst a provider. Translation
 * uses its own higher-allowance limiter (see translationRateLimiter) because it
 * issues batched, latency-sensitive calls that must not serialize behind
 * explanation traffic. Defaults to at most 5 requests per 10 seconds — friendly
 * to local models and free tiers alike.
 */
export const sharedRateLimiter: RateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 10_000 });

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const now = options.now ?? Date.now;
  const bucket: Bucket = { tokens: options.maxRequests, nextRefill: now() };
  const refillPerToken = options.windowMs / options.maxRequests;

  let waitTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

  function refill(): void {
    const current = now();
    if (current < bucket.nextRefill) return;
    const elapsed = current - bucket.nextRefill;
    const added = Math.floor(elapsed / refillPerToken) + 1;
    bucket.tokens = Math.min(options.maxRequests, bucket.tokens + added);
    // Next refill boundary is the next token-time strictly after current time.
    bucket.nextRefill = current + (refillPerToken - (elapsed % refillPerToken)) || current + refillPerToken;
  }

  function scheduleNextDrain(): void {
    if (waitTimer || pending.length === 0) return;
    const wait = Math.max(0, bucket.nextRefill - now());
    waitTimer = setTimeout(() => {
      waitTimer = null;
      refill();
      drainReadyQueue();
    }, wait);
  }

  function drainReadyQueue(): void {
    refill();
    while (bucket.tokens >= 1 && pending.length > 0) {
      bucket.tokens -= 1;
      const next = pending.shift();
      next?.resolve();
    }
    scheduleNextDrain();
  }

  return {
    acquire(signal?: AbortSignal): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        const waiter = { resolve, reject };
        const originalResolve = waiter.resolve;
        waiter.resolve = (): void => {
          signal?.removeEventListener('abort', onAbort);
          originalResolve();
        };
        const onAbort = (): void => {
          pending = pending.filter((w) => w !== waiter);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        pending.push(waiter);
        drainReadyQueue();
      });
    },
  };
}



