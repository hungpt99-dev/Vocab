import type { Explanation } from '@/shared/types/vocabulary';
import type { Settings } from '@/shared/types/settings';
import { settingsRepository, type SettingsRepository } from '@/storage/settings-repository';
import { getProvider } from './registry';
import type { ExplainRequest } from './types';
import { withRetry, type RetryOptions } from './retry';
import { createRateLimiter, type RateLimiter } from './rate-limiter';

/**
 * AI calls share a single rate limiter so concurrent requests (e.g. several
 * auto-explain saves at once) do not burst the provider. Defaults to at most
 * 5 requests per 10 seconds — friendly to local models and free tiers alike.
 */
const rateLimiter: RateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 10_000 });

const RETRY_OPTIONS: RetryOptions = { maxAttempts: 3 };

/**
 * Application-level entry point for AI explanations: resolves the configured
 * provider, enforces rate limiting, applies retry/backoff, and returns a
 * normalised Explanation.
 */
export class ExplainService {
  constructor(private readonly settings: SettingsRepository = settingsRepository) {}

  async explain(request: ExplainRequest, signal?: AbortSignal): Promise<Explanation> {
    const settings = await this.settings.get();
    return this.explainWith(settings, request, signal);
  }

  async explainWith(
    settings: Settings,
    request: ExplainRequest,
    signal?: AbortSignal,
  ): Promise<Explanation> {
    const provider = getProvider(settings.provider);
    // One rate-limited, retryable attempt. If it is still rate-limited after
    // retries, the 429 surfaces to the caller as a clear, user-facing error.
    await rateLimiter.acquire(signal);
    return withRetry(
      () =>
        provider.explain(request, {
          apiKey: settings.apiKey,
          model: settings.model,
          baseUrl: settings.baseUrl,
          signal,
        }),
      { ...RETRY_OPTIONS, signal },
    );
  }
}

export const explainService = new ExplainService();
