import type { Settings, SavedProvider } from '@/shared/types/settings';
import { settingsRepository, type SettingsRepository } from '@/storage/settings-repository';
import { getProvider } from './registry';
import { aiRateLimiter } from './rate-limiter';
import { withRetry, type RetryOptions } from './retry';
import { AiError, type TranslateRequest } from './types';

const RETRY_OPTIONS: RetryOptions = { maxAttempts: 3 };
/** Bounded in-flight translation requests; preserves result order. */
const CONCURRENCY = 3;

/**
 * Application-level entry point for reading-mode translations. It is the ONLY
 * thing the content script talks to (through the message bus): it resolves the
 * configured provider(s), applies rate-limiting, retry/backoff and optional
 * fallback, and returns a plain translated string per block. No feature code
 * touches a provider SDK directly.
 */
export class TranslateService {
  constructor(private readonly settings: SettingsRepository = settingsRepository) {}

  /**
   * Translate each block into the user's target language. Per-block failures
   * degrade to `null` so one bad block (or a transient hiccup) never fails the
   * whole article; the UI surfaces the gap rather than the error.
   */
  async translateBlocks(
    blocks: string[],
    signal?: AbortSignal,
  ): Promise<Array<string | null>> {
    const settings = await this.settings.get();
    const active = settings.providers.find((p) => p.id === settings.activeProviderId);
    if (!active) {
      throw new AiError('unknown_provider', 'No active AI provider is configured.');
    }
    const fallback = settings.providers.find((p) => p.id === settings.fallbackProviderId);

    const results = new Array<string | null>(blocks.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, blocks.length) }, async () => {
      while (cursor < blocks.length) {
        const index = cursor;
        cursor += 1;
        const text = blocks[index]!;
        results[index] = await this.translateBlock(active, fallback, text, settings, signal).catch(
          () => null,
        );
      }
    });
    await Promise.all(workers);
    return results;
  }

  /** Translate a single block, falling back to a secondary provider on transient failure. */
  private async translateBlock(
    active: SavedProvider,
    fallback: SavedProvider | undefined,
    text: string,
    settings: Settings,
    signal?: AbortSignal,
  ): Promise<string> {
    const request: TranslateRequest = { text, language: settings.targetLanguage };
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

  /** Run a single translation against a specific saved provider. */
  private async runOnce(
    provider: SavedProvider,
    request: TranslateRequest,
    signal?: AbortSignal,
  ): Promise<string> {
    const adapter = getProvider(provider.type);
    await aiRateLimiter.acquire(signal);
    return withRetry(
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
  }
}

export const translateService = new TranslateService();
