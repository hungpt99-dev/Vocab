import type { Explanation } from '@/shared/types/vocabulary';
import type { Settings } from '@/shared/types/settings';
import { settingsRepository, type SettingsRepository } from '@/storage/settings-repository';
import { getProvider } from './registry';
import type { ExplainRequest } from './types';

/**
 * Application-level entry point for AI explanations: resolves the configured
 * provider, forwards credentials and returns a normalised Explanation.
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
    return provider.explain(request, {
      apiKey: settings.apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
      signal,
    });
  }
}

export const explainService = new ExplainService();
