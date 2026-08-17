import type { Explanation } from '@/shared/types/vocabulary';
import type { Settings, SavedProvider } from '@/shared/types/settings';
import { settingsRepository, type SettingsRepository } from '@/storage/settings-repository';
import { runAiCall, runWithFallback } from './pipeline';
import type { ExplainRequest } from './types';
import { AiError } from './types';

const EXPLAIN_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

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
    cacheTtlMs = EXPLAIN_CACHE_TTL_MS,
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

    const cached = this.readCache(active, request);
    if (cached) return cached;

    const { value, active: servedBy } = await runWithFallback(
      settings,
      (provider, sig) => this.runOnce(provider, request, sig),
      signal,
    );
    this.writeCache(servedBy, request, value);
    return value;
  }

  /** Run a single request against a specific saved provider. */
  runOnce(
    provider: SavedProvider,
    request: ExplainRequest,
    signal?: AbortSignal,
  ): Promise<Explanation> {
    return runAiCall(provider, (adapter, config) => adapter.explain(request, config), signal);
  }

  private cacheKey(provider: SavedProvider, request: ExplainRequest): string {
    return `${provider.type}|${provider.model}|${request.word}|${request.context ?? ''}|${request.language ?? ''}|${request.kind ?? 'word'}|${request.pageTitle ?? ''}|${request.precedingText ?? ''}`;
  }

  private readCache(provider: SavedProvider, request: ExplainRequest): Explanation | null {
    const key = this.cacheKey(provider, request);
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.explanation;
    this.cache.delete(key);
    return null;
  }

  private writeCache(
    provider: SavedProvider,
    request: ExplainRequest,
    explanation: Explanation,
  ): void {
    this.cache.set(this.cacheKey(provider, request), {
      explanation,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}

export const explainService = new ExplainService();
