import type { Settings, SavedProvider } from '@/shared/types/settings';
import { settingsRepository, type SettingsRepository } from '@/storage/settings-repository';
import { runAiCall, runWithFallback } from './pipeline';
import type { TranslateRequest } from './types';

/**
 * Application-level entry point for page translation. It is the ONLY thing the
 * content script talks to: it resolves the configured provider(s), applies
 * rate-limiting and retry/backoff via the shared AI pipeline, and returns the
 * translated unit. No content-script code touches a provider SDK.
 */
export class TranslationService {
  constructor(private readonly settings: SettingsRepository = settingsRepository) {}

  async translate(request: TranslateRequest, signal?: AbortSignal): Promise<string> {
    const settings = await this.settings.get();
    return this.translateWith(settings, request, signal);
  }

  /** Translate using an explicit settings object (used by tests). */
  async translateWith(
    settings: Settings,
    request: TranslateRequest,
    signal?: AbortSignal,
  ): Promise<string> {
    const language = request.language || settings.targetLanguage || 'English';
    const { value } = await runWithFallback(
      settings,
      (provider, sig) => this.runOnce(provider, { ...request, language }, sig),
      signal,
    );
    return value;
  }

  /** Run a single translation against a specific saved provider. */
  runOnce(
    provider: SavedProvider,
    request: TranslateRequest,
    signal?: AbortSignal,
  ): Promise<string> {
    return runAiCall(
      provider,
      (adapter, config) => adapter.translate(request, config),
      signal,
    );
  }
}

export const translationService = new TranslationService();
