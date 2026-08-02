import { useCallback, useEffect, useState } from 'react';
import type { Settings, SettingsPatch } from '@/shared/types/settings';
import { DEFAULT_SETTINGS, settingsRepository } from '@/storage/settings-repository';

export interface UseSettingsResult {
  settings: Settings;
  loading: boolean;
  update: (patch: SettingsPatch) => Promise<void>;
}

/** Read settings and stay subscribed to external changes. */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void settingsRepository.get().then((value) => {
      if (!active) return;
      setSettings(value);
      setLoading(false);
    });
    const unsubscribe = settingsRepository.onChange(setSettings);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const update = useCallback(async (patch: SettingsPatch) => {
    // Apply optimistically so controlled inputs never flicker back to their
    // previous value while the asynchronous write is in flight.
    setSettings((current) => ({ ...current, ...patch }));
    setSettings(await settingsRepository.update(patch));
  }, []);

  return { settings, loading, update };
}
