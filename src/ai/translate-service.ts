import type { Settings, SavedProvider } from '@/shared/types/settings';
import { settingsRepository, type SettingsRepository } from '@/storage/settings-repository';
import { getProvider } from './registry';
import { googleTranslate } from './google-translate';
import { runActiveWithFallback } from './run-with-fallback';
import type { TranslateRequest, TranslationParagraph, TranslationResult, WordAlignResult } from './types';
import { AiError } from './types';
import { withRetry, type RetryOptions } from './retry';
import { sharedRateLimiter } from './rate-limiter';

const RETRY_OPTIONS: RetryOptions = { maxAttempts: 3 };

/** Keep each provider request small enough to stay inside a model context. */
const CHUNK_SIZE = 16;

/** How many chunks may be in flight at once (network overlap, bounded). */
const CHUNK_CONCURRENCY = 3;

/** Run `task` over items with a bounded number of concurrent executions. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await task(item);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

interface CacheEntry {
  translations: string[];
  expiresAt: number;
}

/**
 * Application-level entry point for paragraph translation. It is the only thing
 * feature code talks to: it resolves the configured provider(s), applies
 * caching, rate-limiting, retry/backoff and optional fallback, and returns a
 * normalised result keyed by the caller's paragraph ids. No feature code
 * touches a provider SDK directly.
 */
export class TranslateService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly alignCache = new Map<string, { results: WordAlignResult[]; expiresAt: number }>();
  private readonly cacheTtlMs: number;

  constructor(
    private readonly settings: SettingsRepository = settingsRepository,
    cacheTtlMs = 1000 * 60 * 60 * 24,
  ) {
    this.cacheTtlMs = cacheTtlMs;
  }

  async translate(
    paragraphs: readonly TranslationParagraph[],
    language: string,
    signal?: AbortSignal,
  ): Promise<TranslationResult[]> {
    const settings = await this.settings.get();
    return this.translateWith(settings, paragraphs, language, signal);
  }

  /** Translate using an explicit settings object (used by tests). */
  async translateWith(
    settings: Settings,
    paragraphs: readonly TranslationParagraph[],
    language: string,
    signal?: AbortSignal,
  ): Promise<TranslationResult[]> {
    const active = settings.providers.find((p) => p.id === settings.activeProviderId);
    if (!active) {
      throw new AiError('unknown_provider', 'No active AI provider is configured.');
    }
    // Keyless fallback: if the active provider needs an API key but has none, the
    // configured AI path cannot run. Rather than leave the page silently
    // monolingual, fall back to the no-key translation endpoint so bilingual
    // reading works out of the box. A configured provider (with a key, or a local
    // one like Ollama/LM Studio that needs no key) always takes precedence.
    const adapter = getProvider(active.type);
    if (adapter.requiresApiKey && !active.apiKey) {
      // Keyless fallback: reuse the same per-chunk cache as the AI path so a
      // re-render of the same text does not re-hit the network.
      const out: TranslationResult[] = [];
      for (let start = 0; start < paragraphs.length; start += CHUNK_SIZE) {
        const chunk = paragraphs.slice(start, start + CHUNK_SIZE);
        const cached = this.readCache(active, chunk, language);
        const translations =
          cached ?? (await googleTranslate.translate(chunk.map((p) => p.text), language));
        if (!cached) this.writeCache(active, chunk, language, translations);
        chunk.forEach((paragraph, index) => {
          out.push({ id: paragraph.id, text: paragraph.text, translation: translations[index] ?? '' });
        });
      }
      return out;
    }
    const fallback = settings.providers.find((p) => p.id === settings.fallbackProviderId);

    const chunks: TranslationParagraph[][] = [];
    for (let start = 0; start < paragraphs.length; start += CHUNK_SIZE) {
      chunks.push(paragraphs.slice(start, start + CHUNK_SIZE));
    }
    const chunked = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunk) =>
      this.translateChunk(active, fallback, chunk, language, signal),
    );
    return chunked.flat();
  }

  /** Word-by-word aligned translation: returns ordered source→target glosses. */
  async alignWords(
    paragraphs: readonly TranslationParagraph[],
    language: string,
    signal?: AbortSignal,
  ): Promise<WordAlignResult[]> {
    const settings = await this.settings.get();
    return this.alignWith(settings, paragraphs, language, signal);
  }

  async alignWith(
    settings: Settings,
    paragraphs: readonly TranslationParagraph[],
    language: string,
    signal?: AbortSignal,
  ): Promise<WordAlignResult[]> {
    const active = settings.providers.find((p) => p.id === settings.activeProviderId);
    if (!active) {
      throw new AiError('unknown_provider', 'No active AI provider is configured.');
    }
    // Keyless fallback (same rationale as translateWith): a provider that needs a
    // key but has none cannot produce word alignments, so use the no-key endpoint,
    // which returns both a faithful full-sentence translation and single-word
    // glosses per token.
    const alignAdapter = getProvider(active.type);
    if (alignAdapter.requiresApiKey && !active.apiKey) {
      // Keyless fallback: cache per chunk so repeated rendering is instant.
      const out: WordAlignResult[] = [];
      for (let start = 0; start < paragraphs.length; start += CHUNK_SIZE) {
        const chunk = paragraphs.slice(start, start + CHUNK_SIZE).map((p) => ({ id: p.id, text: p.text }));
        const cached = this.readAlignCache(active, chunk, language);
        const results = cached ?? (await googleTranslate.align(chunk, language));
        if (!cached) this.writeAlignCache(active, chunk, language, results);
        out.push(...results);
      }
      return out;
    }
    const fallback = settings.providers.find((p) => p.id === settings.fallbackProviderId);

    const chunks: TranslationParagraph[][] = [];
    for (let start = 0; start < paragraphs.length; start += CHUNK_SIZE) {
      chunks.push(paragraphs.slice(start, start + CHUNK_SIZE));
    }
    const chunked = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunk) =>
      this.alignChunk(active, fallback, chunk, language, signal),
    );
    return chunked.flat();
  }

  private async translateChunk(
    active: SavedProvider,
    fallback: SavedProvider | undefined,
    chunk: readonly TranslationParagraph[],
    language: string,
    signal?: AbortSignal,
  ): Promise<TranslationResult[]> {
    const cached = this.readCache(active, chunk, language);
    const translations = cached ?? (await this.runChunk(active, fallback, chunk, language, signal));
    if (!cached) this.writeCache(active, chunk, language, translations);

    return chunk.map((paragraph, index) => ({
      id: paragraph.id,
      text: paragraph.text,
      translation: translations[index] ?? '',
    }));
  }

  private async runChunk(
    active: SavedProvider,
    fallback: SavedProvider | undefined,
    chunk: readonly TranslationParagraph[],
    language: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const request: TranslateRequest = {
      paragraphs: chunk.map(({ text }) => ({ text })),
      language,
    };
    return runActiveWithFallback(
      (provider) => this.runOnce(provider, request, signal),
      active,
      fallback,
      { kind: 'translate', language, paragraphs: chunk.map(({ text }) => text) },
    );
  }

  private async alignChunk(
    active: SavedProvider,
    fallback: SavedProvider | undefined,
    chunk: readonly TranslationParagraph[],
    language: string,
    signal?: AbortSignal,
  ): Promise<WordAlignResult[]> {
    const cached = this.readAlignCache(active, chunk, language);
    const results = cached ?? (await this.runAlignChunk(active, fallback, chunk, language, signal));
    if (!cached) this.writeAlignCache(active, chunk, language, results);
    return results;
  }

  private async runAlignChunk(
    active: SavedProvider,
    fallback: SavedProvider | undefined,
    chunk: readonly TranslationParagraph[],
    language: string,
    signal?: AbortSignal,
  ): Promise<WordAlignResult[]> {
    const request: TranslateRequest = {
      paragraphs: chunk.map(({ id, text }) => ({ id, text })),
      language,
    };
    return runActiveWithFallback(
      (provider) => this.runAlignOnce(provider, request, signal),
      active,
      fallback,
      { kind: 'align', language, pairs: chunk.map(({ id, text }) => ({ id, text })) },
    );
  }

  private async runAlignOnce(
    provider: SavedProvider,
    request: TranslateRequest,
    signal?: AbortSignal,
  ): Promise<WordAlignResult[]> {
    const adapter = getProvider(provider.type);
    await sharedRateLimiter.acquire(signal);
    const result = await withRetry(
      () => adapter.align(request, {
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
    return result;
  }

  private async runOnce(
    provider: SavedProvider,
    request: TranslateRequest,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const adapter = getProvider(provider.type);
    await sharedRateLimiter.acquire(signal);
    const result = await withRetry(
      () =>
        adapter.translate(request, {
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
    return result.paragraphs.map(({ translation }) => translation);
  }

  private cacheKey(
    provider: SavedProvider,
    paragraphs: readonly TranslationParagraph[],
    language: string,
  ): string {
    const body = paragraphs.map(({ text }) => text).join('␞');
    return `${provider.type}|${provider.model}|${language}|${body}`;
  }

  private readCache(
    provider: SavedProvider,
    paragraphs: readonly TranslationParagraph[],
    language: string,
  ): string[] | null {
    const key = this.cacheKey(provider, paragraphs, language);
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.translations;
    this.cache.delete(key);
    return null;
  }

  private writeCache(
    provider: SavedProvider,
    paragraphs: readonly TranslationParagraph[],
    language: string,
    translations: readonly string[],
  ): void {
    this.cache.set(this.cacheKey(provider, paragraphs, language), {
      translations: [...translations],
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  private alignCacheKey(
    provider: SavedProvider,
    paragraphs: readonly TranslationParagraph[],
    language: string,
  ): string {
    const body = paragraphs.map(({ text }) => text).join('␞');
    return `align|${provider.type}|${provider.model}|${language}|${body}`;
  }

  private readAlignCache(
    provider: SavedProvider,
    paragraphs: readonly TranslationParagraph[],
    language: string,
  ): WordAlignResult[] | null {
    const key = this.alignCacheKey(provider, paragraphs, language);
    const entry = this.alignCache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.results;
    this.alignCache.delete(key);
    return null;
  }

  private writeAlignCache(
    provider: SavedProvider,
    paragraphs: readonly TranslationParagraph[],
    language: string,
    results: readonly WordAlignResult[],
  ): void {
    this.alignCache.set(this.alignCacheKey(provider, paragraphs, language), {
      results: results.map((r) => ({ ...r, pairs: [...r.pairs] })),
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}

export const translateService = new TranslateService();
