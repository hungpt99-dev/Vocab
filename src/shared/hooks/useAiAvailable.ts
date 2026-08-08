import { useMemo } from 'react';
import { useSettings } from './useSettings';

/**
 * Whether an AI provider is actually usable for Explain/enrich *right now*.
 *
 * The explain pipeline throws "No active AI provider is configured" unless the
 * active provider either needs no key (local Ollama / LM Studio) or has a
 * non-empty key. Surfacing this lets the popup grey out AI actions with a clear
 * reason instead of failing on click — translation (keyless Google) is separate
 * and always available.
 */
export function useAiAvailable(): { available: boolean; providerName: string | null } {
  const { settings } = useSettings();
  return useMemo(() => {
    const active = settings.providers.find((p) => p.id === settings.activeProviderId);
    if (!active) return { available: false, providerName: null };
    const needsKey = !['ollama', 'lmstudio'].includes(active.type);
    const hasKey = (active.apiKey ?? '').trim().length > 0;
    const available = needsKey ? hasKey : true;
    return { available, providerName: active.name };
  }, [settings.providers, settings.activeProviderId]);
}
