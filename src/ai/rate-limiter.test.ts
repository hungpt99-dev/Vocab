import { describe, expect, it, vi } from 'vitest';
import {
  translationRateLimiter,
  sharedRateLimiter,
  TRANSLATION_RATE_LIMIT,
  createRateLimiter,
} from './rate-limiter';

/** Fire `n` acquires but only wait up to `windowMs`; count how many resolved. */
async function permitsInWindow(limiter: {
  acquire(signal?: AbortSignal): Promise<void>;
}, n: number, windowMs: number): Promise<number> {
  const start = Date.now();
  let resolved = 0;
  for (let i = 0; i < n; i++) {
    void limiter.acquire().then(() => {
      if (Date.now() - start <= windowMs) resolved += 1;
    });
  }
  // Don't await the throttled ones (they may take many seconds); just wait the
  // window, then count what resolved in time.
  await new Promise((r) => setTimeout(r, windowMs + 50));
  return resolved;
}

describe('rate limiter', () => {
  it('grants the translation limiter a far higher burst than the shared one', async () => {
    // Within the first second the translation path should let many chunks fly
    // (so a long page does not serialize 2s apart), whereas the shared limiter
    // caps at 5 per 10s.
    const translationBurst = await permitsInWindow(translationRateLimiter, 12, 1000);
    const sharedBurst = await permitsInWindow(sharedRateLimiter, 12, 1000);

    expect(TRANSLATION_RATE_LIMIT.maxRequests).toBeGreaterThanOrEqual(20);
    // The dedicated limiter must not throttle the first screenful like the
    // conservative shared one does (5 tokens over 10s ~= 1 within 1s after burst).
    expect(translationBurst).toBeGreaterThan(sharedBurst);
  });

  it('refreshes permits over time (token bucket)', async () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });

    await limiter.acquire();
    await limiter.acquire();
    // The third permit must not resolve until the bucket refills (~1s later).
    const third = limiter.acquire();
    let settled = false;
    void third.then(() => { settled = true; });
    await Promise.race([third, Promise.resolve()]);
    expect(settled).toBe(false);
    // Advance past the refill window.
    await vi.advanceTimersByTimeAsync(1100);
    await expect(third).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
