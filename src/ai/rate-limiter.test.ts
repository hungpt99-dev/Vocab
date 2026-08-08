import { describe, expect, it, vi } from 'vitest';
import { sharedRateLimiter, createRateLimiter } from './rate-limiter';

/** Fire `n` acquires but only wait up to `windowMs`; count how many resolved. */
async function permitsInWindow(
  limiter: { acquire(signal?: AbortSignal): Promise<void> },
  n: number,
  windowMs: number,
): Promise<number> {
  const start = Date.now();
  let resolved = 0;
  for (let i = 0; i < n; i++) {
    void limiter.acquire().then(() => {
      if (Date.now() - start <= windowMs) resolved += 1;
    });
  }
  await new Promise((r) => setTimeout(r, windowMs + 50));
  return resolved;
}

describe('rate limiter', () => {
  it('caps the shared limiter at ~5 requests per 10s', async () => {
    // Bilingual reading does NOT use this limiter (it is keyless Google);
    // this limiter guards explanation-style calls (auto-explain, enrich).
    const burst = await permitsInWindow(sharedRateLimiter, 12, 1000);
    // Conservative limiter: after the initial 5 tokens, the next token is ~2s
    // away, so within 1s only the burst (~5) resolves.
    expect(burst).toBeLessThanOrEqual(6);
    expect(burst).toBeGreaterThanOrEqual(4);
  });

  it('refreshes permits over time (token bucket)', async () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });

    await limiter.acquire();
    await limiter.acquire();
    const third = limiter.acquire();
    let settled = false;
    void third.then(() => {
      settled = true;
    });
    await Promise.race([third, Promise.resolve()]);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1100);
    await expect(third).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
