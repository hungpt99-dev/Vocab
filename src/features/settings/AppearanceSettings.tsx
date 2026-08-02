import type { Settings } from '@/shared/types/settings';

export interface AppearanceSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

export function AppearanceSettings({ settings, onChange }: AppearanceSettingsProps) {
  return (
    <section aria-labelledby="appearance-heading" className="flex flex-col gap-3">
      <h2 id="appearance-heading" className="text-sm font-semibold">
        Highlighting
      </h2>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.highlightEnabled}
          onChange={(event) => void onChange({ highlightEnabled: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300"
        />
        Highlight saved words on every page
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.autoExplainOnSave}
          onChange={(event) => void onChange({ autoExplainOnSave: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300"
        />
        Ask the AI automatically when a new word is saved
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="highlight-color" className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Highlight colour
        </label>
        <div className="flex items-center gap-2">
          <input
            id="highlight-color"
            type="color"
            value={settings.highlightColor}
            onChange={(event) => void onChange({ highlightColor: event.target.value })}
            className="h-9 w-16 cursor-pointer rounded border border-slate-300 dark:border-slate-700"
          />
          <span className="font-mono text-xs text-slate-500">{settings.highlightColor}</span>
          <mark
            className="rounded px-2 py-0.5 text-sm text-slate-900"
            style={{ backgroundColor: settings.highlightColor }}
          >
            preview
          </mark>
        </div>
      </div>
    </section>
  );
}
