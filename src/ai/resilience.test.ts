import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError } from './types';
import { isRetryable, withRetry } from './retry';
import { createRateLimiter } from './rate-limiter';

describe('withRetry', () => {
  it('returns the result on the first success', async () => {
    const attempt = vi.fn(async () => 'ok');
    await expect(withRetry(attempt)).resolves.toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('retries transient errors with backoff', async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new AiError('server_error', 'boom'))
      .mockRejectedValueOnce(new AiError('rate_limited', 'slow down'))
      .mockResolvedValueOnce('ok');
    const delays: number[] = [];
    const computeDelayMs = vi.fn((attempt: number) => {
      const d = [100, 200][attempt] ?? 200;
      delays.push(d);
      return d;
    });

    await expect(withRetry(attempt, { maxAttempts: 3, computeDelayMs })).resolves.toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([100, 200]);
  });

  it('does not retry non-retryable errors', async () => {
    const attempt = vi.fn(async () => {
      throw new AiError('unauthorized', 'bad key');
    });
    await expect(
      withRetry(attempt, { maxAttempts: 3, computeDelayMs: () => 0 }),
    ).rejects.toMatchObject({ code: 'unauthorized' });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('does not retry bad_response', async () => {
    const attempt = vi.fn(async () => {
      throw new AiError('bad_response', 'no meaning');
    });
    await expect(withRetry(attempt, { computeDelayMs: () => 0 })).rejects.toMatchObject({
      code: 'bad_response',
    });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('stops at maxAttempts and rethrows the last error', async () => {
    const attempt = vi.fn(async () => {
      throw new AiError('network', 'down');
    });
    await expect(
      withRetry(attempt, { maxAttempts: 2, computeDelayMs: () => 0 }),
    ).rejects.toMatchObject({ code: 'network' });
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('fails immediately when the signal is already aborted', async () => {
    const attempt = vi.fn(async () => 'ok');
    await expect(
      withRetry(attempt, { signal: AbortSignal.abort(), computeDelayMs: () => 0 }),
    ).rejects.toMatchObject({ code: 'aborted' });
    expect(attempt).not.toHaveBeenCalled();
  });

  it('aborts during the backoff delay instead of retrying', async () => {
    const controller = new AbortController();
    const attempt = vi.fn(async () => {
      throw new AiError('network', 'down');
    });
    const promise = withRetry(attempt, {
      maxAttempts: 3,
      signal: controller.signal,
      computeDelayMs: () => 0,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'aborted' });
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});

describe('isRetryable', () => {
  it('classifies transient codes as retryable', () => {
    for (const code of ['rate_limited', 'server_error', 'network', 'timeout'] as const) {
      expect(isRetryable(new AiError(code, ''))).toBe(true);
    }
  });
  it('classifies permanent codes as not retryable', () => {
    for (const code of [
      'unauthorized',
      'missing_api_key',
      'bad_response',
      'unknown_provider',
    ] as const) {
      expect(isRetryable(new AiError(code, ''))).toBe(false);
    }
  });
});

describe('createRateLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('admits up to maxRequests immediately, then waits for the window', async () => {
    let clock = 0;
    const now = vi.fn(() => clock);
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 10_000, now });

    await expect(limiter.acquire()).resolves.toBeUndefined();
    await expect(limiter.acquire()).resolves.toBeUndefined();

    let thirdResolved = false;
    const third = limiter.acquire().then(() => {
      thirdResolved = true;
    });
    // No time has passed, so a third token is not yet available.
    await vi.advanceTimersByTimeAsync(10);
    expect(thirdResolved).toBe(false);

    // Advance past the window so a token refills.
    clock = 10_000;
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(third).resolves.toBeUndefined();
    expect(thirdResolved).toBe(true);
  });

  it('rejects an already-aborted acquire', async () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 10_000 });
    await expect(limiter.acquire(AbortSignal.abort())).rejects.toThrow();
  });
});
