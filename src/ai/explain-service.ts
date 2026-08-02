import type { Explanation } from '@/shared/types/vocabulary';
import type { Settings, SavedProvider } from '@/shared/types/settings';
import { settingsRepository, type SettingsRepository } from '@/storage/settings-repository';
import { getProvider } from './registry';
import type { ExplainRequest } from './types';
import { AiError } from './types';
import { withRetry, type RetryOptions } from './retry';
import { createRateLimiter, type RateLimiter } from './rate-limiter';

/**
 * AI calls share a single rate limiter so concurrent requests (e.g. several
 * auto-explain saves at once) do not burst the provider. Defaults to at most
 * 5 requests per 10 seconds — friendly to local models and free tiers alike.
 */
const rateLimiter: RateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 10_000 });

const RETRY_OPTIONS: RetryOptions = { maxAttempts: 3 };

interface CacheEntry {
  explanation: Explanation;
  expiresAt: number;
}

/**
 * Application-level entry point for AI explanations. It is the ONLY thing the
 * UI talks to: it resolves the configured provider(s), applies caching,
 * rate-limiting, retry/backoff and optional fallback, and returns a normalised
 * Explanation. No feature code touches a provider SDK directly.
 */
export class ExplainService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;

  constructor(
    private readonly settings: SettingsRepository = settingsRepository,
    cacheTtlMs = 1000 * 60 * 60 * 24,
  ) {
    this.cacheTtlMs = cacheTtlMs;
  }

  async explain(request: ExplainRequest, signal?: AbortSignal): Promise<Explanation> {
    const settings = await this.settings.get();
    return this.explainWith(settings, request, signal);
  }

  /** Explain using an explicit settings object (used by "Test connection"). */
  async explainWith(
    settings: Settings,
    request: ExplainRequest,
    signal?: AbortSignal,
  ): Promise<Explanation> {
    const active = settings.providers.find((p) => p.id === settings.activeProviderId);
    if (!active) {
      throw new AiError('unknown_provider', 'No active AI provider is configured.');
    }
    const fallback = settings.providers.find((p) => p.id === settings.fallbackProviderId);

    const cached = this.readCache(active, request);
    if (cached) return cached;

    const explanation = await this.runWithFallback(active, fallback, request, signal);
    this.writeCache(active, request, explanation);
    return explanation;
  }

  /** Run a single request against a specific saved provider. */
  async runOnce(
    provider: SavedProvider,
    request: ExplainRequest,
    signal?: AbortSignal,
  ): Promise<Explanation> {
    const adapter = getProvider(provider.type);
    await rateLimiter.acquire(signal);
    return withRetry(
      () =>
        adapter.explain(request, {
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

  private async runWithFallback(
    active: SavedProvider,
    fallback: SavedProvider | undefined,
    request: ExplainRequest,
    signal?: AbortSignal,
  ): Promise<Explanation> {
    try {
      return await this.runOnce(active, request, signal);
    } catch (primaryError) {
      if (!fallback) throw primaryError;
      // Only fall back on transient/retryable failures, never on a hard config error.
      const code = primaryError instanceof AiError ? primaryError.code : 'unknown';
      if (code === 'missing_api_key' || code === 'unauthorized' || code === 'bad_response') {
        throw primaryError;
      }
      return this.runOnce(fallback, request, signal);
    }
  }

  private cacheKey(provider: SavedProvider, request: ExplainRequest): string {
    return `${provider.type}|${provider.model}|${request.word}|${request.context ?? ''}|${request.language ?? ''}|${request.kind ?? 'word'}`;
  }

  private readCache(provider: SavedProvider, request: ExplainRequest): Explanation | null {
    const key = this.cacheKey(provider, request);
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.explanation;
    this.cache.delete(key);
    return null;
  }

  private writeCache(provider: SavedProvider, request: ExplainRequest, explanation: Explanation): void {
    this.cache.set(this.cacheKey(provider, request), {
      explanation,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}

export const explainService = new ExplainService();
export const aiService = explainService;
