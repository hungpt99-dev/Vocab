export const AI_PROVIDER_IDS = [
  'openai',
  'openrouter',
  'lmstudio',
  'ollama',
  'gemini',
  'anthropic',
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export interface Settings {
  provider: AiProviderId;
  apiKey: string;
  model: string;
  /** Optional override for the provider's base URL (local runtimes, proxies). */
  baseUrl: string;
  highlightEnabled: boolean;
  highlightColor: string;
  /** Ask the AI automatically the first time a word is saved. */
  autoExplainOnSave: boolean;
}

export type SettingsPatch = Partial<Settings>;
