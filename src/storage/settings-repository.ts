import type { Settings, SavedProvider, SettingsPatch, AiProviderId } from '@/shared/types/settings';
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
  targetLanguage: 'English',
  highlightEnabled: true,
  highlightColor: DEFAULT_HIGHLIGHT_COLOR,
  autoExplainOnSave: false,
  bilingualMode: true,
  bilingualDomains: [],
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
    goal: '',
    autoScan: false,
    domains: [],
  },
};

/** Common UI languages for the bilingual target-language picker. */
export const LANGUAGES: readonly string[] = [
  'English',
  'Vietnamese',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Russian',
  'Chinese',
  'Japanese',
  'Korean',
  'Indonesian',
  'Thai',
  'Arabic',
  'Hindi',
  'Dutch',
  'Turkish',
  'Polish',
  'Ukrainian',
  'Czech',
];

/** Promote the VOC-133 `goalMode` fields into the VOC-134 `radar` shape.
 * The old goal *text* lived in IndexedDB (a separate "Goal" tab); Radar now
 * keeps the goal text in Settings, so we intentionally do not port it — the
 * user re-enters it. We do preserve their auto-scan + domain preferences. */
function migrateRadar(value: Partial<Settings>): Partial<Settings> {
  const legacy = value as Partial<Settings> & { goalMode?: { autoScan?: boolean; domains?: string[] } };
  if (legacy.goalMode && !('radar' in value)) {
    return {
      ...value,
      radar: {
        goal: '',
        autoScan: Boolean(legacy.goalMode.autoScan),
        domains: Array.isArray(legacy.goalMode.domains) ? legacy.goalMode.domains : [],
      },
    };
  }
  return value;
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
    return { ...DEFAULT_SETTINGS, ...merged };
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
