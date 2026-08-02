import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, settingsRepository } from '@/storage/settings-repository';
/** Read settings and stay subscribed to external changes. */
export function useSettings() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        void settingsRepository.get().then((value) => {
            if (!active)
                return;
            setSettings(value);
            setLoading(false);
        });
        const unsubscribe = settingsRepository.onChange(setSettings);
        return () => {
            active = false;
            unsubscribe();
        };
    }, []);
    const update = useCallback(async (patch) => {
        setSettings(await settingsRepository.update(patch));
    }, []);
    return { settings, loading, update };
}
