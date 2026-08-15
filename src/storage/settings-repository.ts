import type { Settings, SavedProvider, SettingsPatch, AiProviderId } from '@/shared/types/settings';
import type { Language } from '@/shared/types/language';
import { asLanguage, DEFAULT_LANGUAGE } from '@/shared/types/language';
import { DEFAULT_HIGHLIGHT_COLOR, reading as readingTokens } from '@/shared/styles/tokens';

export const SETTINGS_KEY = 'avs:settings';

/**
 * Legacy single-provider shape (pre multi-provider model). Kept only to migrate
 * existing stored settings forward; new writes never use it.
 */
interface LegacySettings {
  provider?: AiProviderId;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  highlightEnabled?: boolean;
  highlightColor?: string;
  autoExplainOnSave?: boolean;
}

/** A default OpenAI provider so first-run users have something active. */
function defaultProviders(): SavedProvider[] {
  return [
    {
      id: 'prov_default',
      type: 'openai',
      name: 'OpenAI',
      apiKey: '',
      baseUrl: '',
      model: '',
      enabled: true,
    },
  ];
}

export const DEFAULT_SETTINGS: Settings = {
  providers: defaultProviders(),
  activeProviderId: 'prov_default',
  fallbackProviderId: undefined,
  targetLanguage: DEFAULT_LANGUAGE,
  highlightEnabled: true,
  highlightColor: DEFAULT_HIGHLIGHT_COLOR,
  autoExplainOnSave: false,
  readingMode: 'everywhere',
  allowedDomains: [],
  popupShowTranslation: true,
  popupShowSimplify: true,
  popupDefaultTab: 'library',
  explainPromptTemplate: '',
  readingExperience: {
    showOriginal: true,
    showTranslation: true,
    width: readingTokens.width,
    fontSize: readingTokens.fontSize,
    spacing: readingTokens.spacing,
  },
  radar: {
    enabled: true,
  },
};

/** Common UI languages for the bilingual target-language picker (full languages). */
export const LANGUAGES: readonly Language[] = [
  { code: 'en-US', name: 'English' },
  { code: 'vi-VN', name: 'Vietnamese' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-PT', name: 'Portuguese' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'zh-CN', name: 'Chinese' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'id-ID', name: 'Indonesian' },
  { code: 'th-TH', name: 'Thai' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'nl-NL', name: 'Dutch' },
  { code: 'tr-TR', name: 'Turkish' },
  { code: 'pl-PL', name: 'Polish' },
  { code: 'uk-UA', name: 'Ukrainian' },
  { code: 'cs-CZ', name: 'Czech' },
];

/** Look up a built-in Language by its BCP-47 code, or undefined if custom. */
export function languageByCode(code: string): Language | undefined {
  return LANGUAGES.find((language) => language.code === code);
}

/**
 * Promote the VOC-133 `goalMode` / VOC-134 `radar` fields plus the legacy
 * `bilingualMode`/`bilingualDomains` into the unified reading model
 * (`readingMode` + `allowedDomains`). Both Bilingual and Radar are now driven
 * by the single tri-state `readingMode`, so:
 *   - `bilingualMode` true (or `radar.autoScan` true) → 'everywhere' unless a
 *     domain list was in use, in which case 'allowed' + migrated domains.
 *   - otherwise → 'off'.
 * The Radar goal text is intentionally NOT ported (it lived in IndexedDB and the
 * user re-enters it in Settings); we only preserve scope/domain preferences.
 */
function migrateRadar(value: Partial<Settings>): Partial<Settings> {
  const legacy = value as Partial<Settings> & {
    goalMode?: { autoScan?: boolean; domains?: string[] };
    bilingualMode?: boolean;
    bilingualDomains?: string[];
    radar?: { goal?: string; autoScan?: boolean; domains?: string[] };
  };

  // Already on the new shape (has readingMode) — nothing to migrate.
  if ('readingMode' in value) return value;

  const radarLegacy = legacy.radar ?? legacy.goalMode;
  const hadDomains =
    (Array.isArray(legacy.bilingualDomains) && legacy.bilingualDomains.length > 0) ||
    (Array.isArray(radarLegacy?.domains) && radarLegacy.domains.length > 0);
  const wasOn =
    legacy.bilingualMode === true ||
    radarLegacy?.autoScan === true ||
    (typeof legacy.bilingualMode === 'undefined' && legacy.bilingualDomains?.length);

  const readingMode: Settings['readingMode'] = hadDomains
    ? 'allowed'
    : wasOn
      ? 'everywhere'
      : 'off';

  const allowedDomains = [
    ...(legacy.bilingualDomains ?? []),
    ...(radarLegacy?.domains ?? []),
  ].filter((domain, index, all) => Boolean(domain) && all.indexOf(domain) === index);

  return {
    ...value,
    readingMode,
    allowedDomains,
  };
}

/** Promote a legacy string `targetLanguage` ('Vietnamese') to a full `Language`. */
function migrateTargetLanguage(value: Partial<Settings>): Partial<Settings> {
  const existing = value.targetLanguage;
  if (existing && typeof existing === 'object' && 'code' in existing && 'name' in existing) {
    return value; // Already a Language.
  }
  if (typeof existing === 'string') {
    return { ...value, targetLanguage: asLanguage(existing) };
  }
  return value; // Falls back to DEFAULT_SETTINGS.targetLanguage (a Language).
}

/** Promote the old single-provider fields into the new providers array. */
function migrateLegacy(value: Partial<Settings> & Partial<LegacySettings>): Partial<Settings> {
  if (Array.isArray(value.providers) && value.providers.length > 0) return value;
  if (!value.provider) return value;

  const legacy: SavedProvider = {
    id: 'prov_default',
    type: value.provider,
    name: value.provider,
    apiKey: value.apiKey ?? '',
    baseUrl: value.baseUrl ?? '',
    model: value.model ?? '',
    enabled: true,
  };
  return {
    ...value,
    providers: [legacy],
    activeProviderId: 'prov_default',
  };
}

/**
 * Settings live in `chrome.storage.local` (not IndexedDB) so the service
 * worker, content scripts and UI surfaces can all read them cheaply and
 * subscribe to change events.
 */
export class SettingsRepository {
  async get(): Promise<Settings> {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const value = (stored[SETTINGS_KEY] as (Partial<Settings> & Partial<LegacySettings>) | undefined) ?? {};
    const merged = migrateRadar(migrateLegacy(value));
    const withLanguage = migrateTargetLanguage(merged);
    return { ...DEFAULT_SETTINGS, ...withLanguage };
  }

  async update(patch: SettingsPatch): Promise<Settings> {
    const next = { ...(await this.get()), ...patch };
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  }

  async reset(): Promise<Settings> {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    return DEFAULT_SETTINGS;
  }

  /** Subscribe to settings changes; returns an unsubscribe function. */
  onChange(listener: (settings: Settings) => void): () => void {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
      listener({
        ...DEFAULT_SETTINGS,
        ...((changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined) ?? {}),
      });
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }
}

export const settingsRepository = new SettingsRepository();
