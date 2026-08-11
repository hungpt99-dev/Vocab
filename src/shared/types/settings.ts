export const AI_PROVIDER_IDS = [
  'openai',
  'openrouter',
  'deepseek',
  'mistral',
  'groq',
  'together',
  'gemini',
  'anthropic',
  'lmstudio',
  'ollama',
  'custom',
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export interface SavedProvider {
  /** Stable local id, e.g. "prov_3f2a". */
  id: string;
  /** Which built-in adapter this saved provider uses. */
  type: AiProviderId;
  /** User-given display name, e.g. "My OpenAI GPT-5 Mini". */
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Sampling temperature (0–1). Provider default when omitted. */
  temperature?: number;
  /** Max tokens to generate. Provider default when omitted. */
  maxTokens?: number;
  /** Per-request timeout in ms. Falls back to the provider default. */
  timeoutMs?: number;
  /** Whether this saved provider is selectable as active/fallback. */
  enabled: boolean;
}

/**
 * User-tunable presentation of the reading overlay (hover card).
 *
 * Values are numeric so the content script can write them to CSS custom
 * properties; defaults mirror the design tokens so the out-of-the-box look
 * is unchanged.
 */
export interface ReadingExperience {
  /** Show the saved word as a heading on the hover card. */
  showOriginal: boolean;
  /** Show the saved meaning on the hover card. */
  showTranslation: boolean;
  /** Hover card max width in px. */
  width: number;
  /** Hover card font size in px. */
  fontSize: number;
  /** Hover card line-height multiplier; also scales row gaps. */
  spacing: number;
}

export interface Settings {
  /** All providers the user has configured. */
  providers: SavedProvider[];
  /** Id of the provider used for explanations. */
  activeProviderId: string;
  /** Optional provider tried once when the active one fails. */
  fallbackProviderId?: string;
  /** Language explanations are written in (the user's language). */
  targetLanguage: string;
  highlightEnabled: boolean;
  highlightColor: string;
  /** Ask the AI automatically the first time a word is saved. */
  autoExplainOnSave: boolean;
  /** Bilingual mode: show translations/meanings inline in the user's language. */
  bilingualMode: boolean;
  /** Domains (hostnames) that automatically turn on bilingual mode, regardless
   *  of the global `bilingualMode` setting. Empty = only the global switch applies. */
  bilingualDomains: string[];
  /** Popup: auto-fetch the keyless translation of the highlighted word on open. */
  popupShowTranslation: boolean;
  /** Popup: show the Simplify action for the highlighted word. */
  popupShowSimplify: boolean;
  /** Popup: which tab to open on launch. */
  popupDefaultTab: 'library' | 'review' | 'quiz' | 'progress';
  /** Editable system-prompt template for explanations. Tokens:
   *  {{language}} {{word}} {{context}} {{kind}} — empty falls back to built-in. */
  explainPromptTemplate: string;
  /** Reading overlay presentation, applied live to open pages. */
  readingExperience: ReadingExperience;
  /** Id of the active Vocabulary Goal (VOC-132), or undefined when none is set. */
  activeGoalId?: string;
}

export type SettingsPatch = Partial<Settings>;
