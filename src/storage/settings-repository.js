export const SETTINGS_KEY = 'avs:settings';
export const DEFAULT_SETTINGS = {
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
    async get() {
        const stored = await chrome.storage.local.get(SETTINGS_KEY);
        const value = stored[SETTINGS_KEY];
        return { ...DEFAULT_SETTINGS, ...(value ?? {}) };
    }
    async update(patch) {
        const next = { ...(await this.get()), ...patch };
        await chrome.storage.local.set({ [SETTINGS_KEY]: next });
        return next;
    }
    async reset() {
        await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
        return DEFAULT_SETTINGS;
    }
    /** Subscribe to settings changes; returns an unsubscribe function. */
    onChange(listener) {
        const handler = (changes, areaName) => {
            if (areaName !== 'local' || !changes[SETTINGS_KEY])
                return;
            listener({
                ...DEFAULT_SETTINGS,
                ...(changes[SETTINGS_KEY].newValue ?? {}),
            });
        };
        chrome.storage.onChanged.addListener(handler);
        return () => chrome.storage.onChanged.removeListener(handler);
    }
}
export const settingsRepository = new SettingsRepository();
