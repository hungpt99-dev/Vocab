import { settingsRepository } from '@/storage/settings-repository';
import { getProvider } from './registry';
/**
 * Application-level entry point for AI explanations: resolves the configured
 * provider, forwards credentials and returns a normalised Explanation.
 */
export class ExplainService {
    settings;
    constructor(settings = settingsRepository) {
        this.settings = settings;
    }
    async explain(request, signal) {
        const settings = await this.settings.get();
        return this.explainWith(settings, request, signal);
    }
    async explainWith(settings, request, signal) {
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
