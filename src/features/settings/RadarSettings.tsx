import { useId } from 'react';
import type { Settings } from '@/shared/types/settings';

export interface RadarSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

/**
 * Vocabulary Radar settings. Radar is a passive, personal vocabulary assistant:
 * related words are generated from the vocabulary you save & enrich, then
 * highlighted when you meet them in the wild. There is no AI search to configure
 * — the only control is the master on/off. *Where* Radar highlights (Off / Allowed
 * sites / Everywhere) is the shared `readingMode` in Reading settings, which also
 * drives Bilingual translations.
 */
export function RadarSettings({ settings, onChange }: RadarSettingsProps) {
  const toggleId = useId();
  const enabled = settings.radar?.enabled ?? true;
  const readingMode = settings.readingMode;

  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Vocabulary Radar</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Radar generates related words from the vocabulary you save and enrich, then highlights them as you
        read.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <label htmlFor={toggleId} className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Enable Radar</span>
          <input
            id={toggleId}
            type="checkbox"
            checked={enabled}
            onChange={(event) =>
              void onChange({ radar: { ...settings.radar, enabled: event.target.checked } })
            }
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600/40"
          />
        </label>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          Radar highlights generated words wherever reading aids are enabled. Choose the scope (Off / Allowed
          sites / Everywhere) in <span className="font-semibold text-slate-600 dark:text-slate-300">Reading</span>{' '}
          settings — it applies to both Bilingual translations and Radar.
          {readingMode === 'off' && (
            <span className="mt-1 block font-medium text-amber-600 dark:text-amber-400">
              Reading mode is currently Off, so Radar will not highlight on any page.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
