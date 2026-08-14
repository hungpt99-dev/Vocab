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
  /**
   * Tri-state reading mode that drives BOTH Bilingual (inline translations) and
   * Vocabulary Radar auto-find from a single control:
   *   - 'off'        → no inline translations; Radar auto-find does not run.
   *   - 'allowed'    → translations + Radar auto-find on `allowedDomains` only.
   *   - 'everywhere' → translations + Radar auto-find on every readable page.
   * Replaces the old separate `bilingualMode` global switch and the per-feature
   * domain lists, so there is one source of truth for where reading aids appear.
   */
  readingMode: 'off' | 'allowed' | 'everywhere';
  /** Hostnames where reading aids (Bilingual + Radar auto-find) activate in
   *  'allowed' mode. Empty in 'allowed' mode means "nowhere"; in 'everywhere'
   *  mode it is ignored. Subdomains are included by the matcher. */
  allowedDomains: string[];
  /** Popup: auto-fetch the keyless translation of the highlighted word on open. */
  popupShowTranslation: boolean;
  /** Popup: show the Simplify action for the highlighted word. */
  popupShowSimplify: boolean;
  /** Popup: which tab to open on launch. */
  popupDefaultTab: 'library' | 'radar' | 'review' | 'quiz' | 'progress';
  /** Editable system-prompt template for explanations. Tokens:
   *  {{language}} {{word}} {{context}} {{kind}} — empty falls back to built-in. */
  explainPromptTemplate: string;
  /** Reading overlay presentation, applied live to open pages. */
  readingExperience: ReadingExperience;
  /** Vocabulary Radar: a natural-language goal used to surface vocabulary that
   * is relevant to what you want to learn. Auto-find is governed by the shared
   * `readingMode` (off / allowed / everywhere) — the same tri-state that drives
   * Bilingual — so there is a single place to choose where reading aids appear. */
  radar: {
    /** The free-text learning goal (the source of truth for what to find). */
    goal: string;
  };
}

/**
 * True when Radar should actively find vocabulary: a goal must be set AND the
 * shared reading mode must be on ('allowed' or 'everywhere'). Mirrors how
 * Bilingual is now evaluated — both are driven by the single `readingMode`.
 */
export function isRadarEnabled(settings: Settings): boolean {
  const hasGoal = Boolean(settings.radar?.goal.trim());
  if (!hasGoal) return false;
  return settings.readingMode !== 'off';
}

/**
 * Whether reading aids (Bilingual inline translations and Radar auto-find)
 * should be active on the given hostname, given the tri-state `readingMode`:
 *   - 'off'        → never.
 *   - 'everywhere' → always.
 *   - 'allowed'    → only when the hostname matches `allowedDomains`.
 * `host` should be the lowercased hostname with any leading "www." stripped.
 */
export function isReadingActiveOnHost(settings: Settings, host: string): boolean {
  if (settings.readingMode === 'off') return false;
  if (settings.readingMode === 'everywhere') return true;
  return matchesDomainList(host, settings.allowedDomains);
}

/** Domain matcher used by the reading scope logic. */
function matchesDomainList(host: string, domains: readonly string[]): boolean {
  if (domains.length === 0) return false;
  const normalized = host.replace(/^www\./i, '').toLowerCase();
  return domains.some((domain) => {
    const base = domain.replace(/^www\./i, '').toLowerCase();
    return normalized === base || normalized.endsWith(`.${base}`);
  });
}

export type SettingsPatch = Partial<Settings>;
