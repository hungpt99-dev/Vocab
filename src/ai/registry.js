import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';
import { OpenAiCompatibleProvider, OPENAI_COMPATIBLE_PRESETS } from './providers/openai-compatible';
import { AiError } from './types';
const providers = new Map();
for (const preset of OPENAI_COMPATIBLE_PRESETS) {
    providers.set(preset.id, new OpenAiCompatibleProvider(preset));
}
providers.set('gemini', new GeminiProvider());
providers.set('anthropic', new AnthropicProvider());
export function getProvider(id) {
    const provider = providers.get(id);
    if (!provider) {
        throw new AiError('unknown_provider', `Unknown AI provider: ${id}`);
    }
    return provider;
}
export function listProviders() {
    return [...providers.values()];
}
