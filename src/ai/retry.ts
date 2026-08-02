import { AiError, type AiErrorCode } from './types';

export interface RetryOptions {
  /** Maximum attempts, including the first. Defaults to 3. */
  maxAttempts?: number;
  /** Abort signal; an aborted request is not retried. */
  signal?: AbortSignal;
  /**
   * Delay in milliseconds before attempt `attempt` (0-based). Defaults to
   * exponential backoff with jitter capped at 10s. Injectable for tests.
   */
  computeDelayMs?: (attempt: number, error: AiError) => number;
}

/**
 * Codes that are worth retrying. These are transient: a replay may succeed.
 * Auth, key, format and unknown-provider failures are permanent and must not
 * be retried — replaying them only wastes the user's quota.
 */
const RETRYABLE: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>([
  'rate_limited',
  'server_error',
  'network',
  'timeout',
]);

export function isRetryable(error: AiError): boolean {
  return RETRYABLE.has(error.code);
}

function defaultBackoff(attempt: number): number {
  const base = 500 * 2 ** attempt; // 500, 1000, 2000
  const jitter = Math.random() * base * 0.25;
  return Math.min(base + jitter, 10_000);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AiError('aborted', 'Request cancelled.'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new AiError('aborted', 'Request cancelled.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Run `attempt`, retrying transient `AiError`s with exponential backoff.
 *
 * - Non-retryable codes (`unauthorized`, `missing_api_key`, `bad_response`,
 *   `unknown_provider`) fail immediately.
 * - An aborted signal fails immediately and never schedules a retry.
 * - The abort signal is honoured during the backoff delay too.
 * - Any non-`AiError` thrown is normalised to `network` before classification.
 */
export async function withRetry<T>(attempt: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, signal, computeDelayMs = defaultBackoff } = options;
  let lastError: unknown = new AiError('network', 'Request failed.');

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new AiError('aborted', 'Request cancelled.');
    try {
      return await attempt();
    } catch (caught) {
      const error = caught instanceof AiError ? caught : normalizeToAiError(caught);
      lastError = error;
      if (signal?.aborted) throw new AiError('aborted', 'Request cancelled.');
      const isLast = i === maxAttempts - 1;
      if (!isRetryable(error) || isLast) throw error;
      await sleep(computeDelayMs(i, error), signal);
    }
  }

  throw lastError instanceof Error ? lastError : new AiError('network', 'Request failed.');
}

function normalizeToAiError(caught: unknown): AiError {
  if (caught instanceof AiError) return caught;
  if (caught instanceof Error) return new AiError('network', caught.message || 'Network request failed.');
  return new AiError('network', 'Network request failed.');
}
