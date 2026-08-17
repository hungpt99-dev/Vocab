import type {
  TranslationParagraph,
  TranslationResult,
  BilingualPerf,
} from './types';
import type { Settings } from '@/shared/types/settings';
import { settingsRepository, type SettingsRepository } from '@/storage/settings-repository';
import { googleTranslate } from './google-translate';
import { bilingualLog } from '@/shared/lib/bilingual-log';
import { mapWithConcurrency } from '@/shared/lib/concurrency';

/** Stable cache key for bilingual translations, which always use keyless Google. */
const GOOGLE_CACHE_PROVIDER = 'google-keyless';

/** Keep each provider request small enough to stay inside a model context. */
const CHUNK_SIZE = 16;

/** How many chunks may be in flight at once (network overlap, bounded). */
const CHUNK_CONCURRENCY = 3;

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
    _settings: Settings,
    paragraphs: readonly TranslationParagraph[],
    language: string,
    signal?: AbortSignal,
  ): Promise<TranslationResult[]> {
    // Bilingual reading never uses the AI provider — it is keyless Google
    // Translate so it works out of the box and stays independent of the user's
    // AI key (which is reserved for Explain / enrich). See VOC-101.
    const perf = this.makePerfCollector(Math.ceil(paragraphs.length / CHUNK_SIZE) || 1);
    const chunks: TranslationParagraph[][] = [];
    for (let start = 0; start < paragraphs.length; start += CHUNK_SIZE) {
      chunks.push(paragraphs.slice(start, start + CHUNK_SIZE));
    }
    const chunked = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunk) =>
      this.translateChunk(chunk, language, signal, perf),
    );
    const out = chunked.flat();
    perf.finish();
    perf.attach(out[0]);
    bilingualLog.sw(
      `translate ${paragraphs.length} paragraphs → ${chunks.length} chunks (google keyless)`,
      perf.summary(),
    );
    return out;
  }

  private async translateChunk(
    chunk: readonly TranslationParagraph[],
    language: string,
    _signal: AbortSignal | undefined,
    perf: PerfCollector,
  ): Promise<TranslationResult[]> {
    const cached = this.readCache(GOOGLE_CACHE_PROVIDER, chunk, language);
    if (cached) perf.markCacheHit();
    const translations =
      cached ??
      (await googleTranslate.translate(
        chunk.map((p) => p.text),
        language,
      ));
    if (!cached) this.writeCache(GOOGLE_CACHE_PROVIDER, chunk, language, translations);

    return chunk.map((paragraph, index) => ({
      id: paragraph.id,
      text: paragraph.text,
      translation: translations[index] ?? '',
    }));
  }

  private cacheKey(
    providerKey: string,
    paragraphs: readonly TranslationParagraph[],
    language: string,
  ): string {
    const body = paragraphs.map(({ text }) => text).join('␞');
    return `${providerKey}|${language}|${body}`;
  }

  private readCache(
    providerKey: string,
    paragraphs: readonly TranslationParagraph[],
    language: string,
  ): string[] | null {
    const key = this.cacheKey(providerKey, paragraphs, language);
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.translations;
    this.cache.delete(key);
    return null;
  }

  private writeCache(
    providerKey: string,
    paragraphs: readonly TranslationParagraph[],
    language: string,
    translations: readonly string[],
  ): void {
    this.cache.set(this.cacheKey(providerKey, paragraphs, language), {
      translations: [...translations],
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  /** Create a perf collector for one translate/align request (debug only). */
  makePerfCollector(chunks: number): PerfCollector {
    return new PerfCollector(chunks);
  }
}

/**
 * Aggregates bilingual-pipeline timing across the chunks of one translate/align
 * request. Off by default; only does real work when the service-worker debug
 * flag is on (see bilingualLog). Attaches a `BilingualPerf` to the first result
 * so the content script can attribute slowness to the network vs. the DOM.
 */
class PerfCollector {
  private rateLimitWaitMs = 0;
  private providerMs = 0;
  private cacheHits = 0;
  private readonly totalChunks: number;
  private readonly startMs: number;

  constructor(totalChunks: number) {
    this.totalChunks = totalChunks;
    this.startMs = performance.now();
  }

  addRateLimitWait(ms: number): void {
    this.rateLimitWaitMs += ms;
  }

  addProviderMs(ms: number): void {
    this.providerMs += ms;
  }

  markCacheHit(): void {
    this.cacheHits += 1;
  }

  finish(): void {
    // no-op; kept for symmetry / future tail logging
  }

  summary(): BilingualPerf {
    return {
      totalMs: Math.round(performance.now() - this.startMs),
      rateLimitWaitMs: Math.round(this.rateLimitWaitMs),
      providerMs: Math.round(this.providerMs),
      chunks: this.totalChunks,
      cacheHits: this.cacheHits,
    };
  }

  attach(result: { perf?: BilingualPerf } | undefined): void {
    if (result) result.perf = this.summary();
  }
}

export const translateService = new TranslateService();
