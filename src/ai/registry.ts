import type { AiProviderId } from '@/shared/types/settings';
import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';
import { OpenAiCompatibleProvider, OPENAI_COMPATIBLE_PRESETS } from './providers/openai-compatible';
import { AiError, type AiProvider } from './types';

const providers = new Map<AiProviderId, AiProvider>();

for (const preset of OPENAI_COMPATIBLE_PRESETS) {
  providers.set(preset.id, new OpenAiCompatibleProvider(preset));
}
providers.set('gemini', new GeminiProvider());
providers.set('anthropic', new AnthropicProvider());

export function getProvider(id: AiProviderId): AiProvider {
  const provider = providers.get(id);
  if (!provider) {
    throw new AiError('unknown_provider', `Unknown AI provider: ${id}`);
  }
  return provider;
}

export function listProviders(): AiProvider[] {
  return [...providers.values()];
}
