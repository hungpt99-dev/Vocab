import type { Settings, SettingsPatch } from '@/shared/types/settings';

export const SETTINGS_KEY = 'avs:settings';

export const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  apiKey: '',
  model: '',
  baseUrl: '',
  highlightEnabled: true,
  highlightColor: '#fde68a',
  autoExplainOnSave: false,
};

/**
 * Settings live in `chrome.storage.local` (not IndexedDB) so the service
 * worker, content scripts and UI surfaces can all read them cheaply and
 * subscribe to change events.
 */
export class SettingsRepository {
  async get(): Promise<Settings> {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const value = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
    return { ...DEFAULT_SETTINGS, ...(value ?? {}) };
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
