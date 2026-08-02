import type { Settings, SavedProvider } from '@/shared/types/settings';
import { getProvider } from './registry';
import type { AiProvider, ProviderConfig } from './types';
import { AiError } from './types';
import { withRetry, type RetryOptions } from './retry';
import { createRateLimiter, type RateLimiter } from './rate-limiter';

/**
 * AI calls share a single rate limiter so concurrent requests (e.g. several
 * paragraphs being translated at once) do not burst the provider. Defaults to
 * at most 5 requests per 10 seconds — friendly to local models and free tiers
 * alike.
 */
const rateLimiter: RateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 10_000 });

const RETRY_OPTIONS: RetryOptions = { maxAttempts: 3 };

export interface AiRunResult<T> {
  value: T;
  /** The provider that actually served the request (the active one). */
  active: SavedProvider;
}

/**
 * Resolve the configured active provider and run it, retrying once against the
 * configured fallback on a transient failure. Hard config errors (bad key,
 * bad response, unknown provider) are never retried.
 */
export async function runWithFallback<T>(
  settings: Settings,
  run: (provider: SavedProvider, signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<AiRunResult<T>> {
  const active = settings.providers.find((p) => p.id === settings.activeProviderId);
  if (!active) {
    throw new AiError('unknown_provider', 'No active AI provider is configured.');
  }
  const fallback = settings.providers.find((p) => p.id === settings.fallbackProviderId);

  try {
    const value = await run(active, signal);
    return { value, active };
  } catch (primaryError) {
    if (!fallback) throw primaryError;
    const code = primaryError instanceof AiError ? primaryError.code : 'unknown';
    if (code === 'missing_api_key' || code === 'unauthorized' || code === 'bad_response') {
      throw primaryError;
    }
    const value = await run(fallback, signal);
    return { value, active };
  }
}

/**
 * Run one provider call through the shared rate limiter and retry/backoff.
 * `call` receives the provider adapter and a fully-resolved config, so the
 * caller decides which capability (explain, translate, …) to invoke.
 */
export async function runAiCall<T>(
  provider: SavedProvider,
  call: (adapter: AiProvider, config: ProviderConfig) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const adapter = getProvider(provider.type);
  await rateLimiter.acquire(signal);
  return withRetry(
    () =>
      call(adapter, {
        apiKey: provider.apiKey,
        model: provider.model,
        baseUrl: provider.baseUrl,
        temperature: provider.temperature,
        maxTokens: provider.maxTokens,
        signal,
        timeoutMs: provider.timeoutMs,
      }),
    { ...RETRY_OPTIONS, signal },
  );
}
