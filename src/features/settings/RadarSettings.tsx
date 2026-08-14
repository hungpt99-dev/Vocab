import { useId } from 'react';
import type { Settings } from '@/shared/types/settings';

export interface RadarSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

/**
 * Vocabulary Radar settings. The learning goal is a free-text field (the source
 * of truth). Auto-find scope is governed by the shared `readingMode` (off /
 * allowed / everywhere) — the same tri-state that drives Bilingual — so there is
 * a single place to choose where reading aids appear (see Reading settings).
 */
export function RadarSettings({ settings, onChange }: RadarSettingsProps) {
  const textareaId = useId();
  const goal = settings.radar?.goal ?? '';
  const readingMode = settings.readingMode;

  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Vocabulary Radar</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Set a learning goal and Radar finds vocabulary relevant to it on the pages you read.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={textareaId} className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Your learning goal
          </label>
          <textarea
            id={textareaId}
            rows={3}
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="e.g. Improve my English for backend engineering and technical communication"
            value={goal}
            onChange={(event) => void onChange({ radar: { ...settings.radar, goal: event.target.value } })}
          />
          <p className="text-[11px] text-slate-400">
            This goal is sent to your AI provider when Radar scans a page.
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          Auto-find runs wherever reading aids are enabled. Choose the scope (Off / Allowed sites / Everywhere)
          in <span className="font-semibold text-slate-600 dark:text-slate-300">Reading</span> settings — it
          applies to both Bilingual translations and Radar.
          {readingMode === 'off' && (
            <span className="mt-1 block font-medium text-amber-600 dark:text-amber-400">
              Reading mode is currently Off, so Radar auto-find will not run. Use “Find for my Radar” in the
              popup, or set the scope to Allowed sites / Everywhere.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
