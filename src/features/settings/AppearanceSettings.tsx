import type { Settings } from '@/shared/types/settings';
import { Checkbox } from '@/shared/ui/Checkbox';

export interface AppearanceSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

export function AppearanceSettings({ settings, onChange }: AppearanceSettingsProps) {
  return (
    <section aria-labelledby="appearance-heading" className="flex flex-col gap-4">
      <h2 id="appearance-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Highlighting
      </h2>

      <Checkbox
        label="Highlight saved words on every page"
        description="Underline words you have saved so they stand out while you read."
        checked={settings.highlightEnabled}
        onChange={(event) => void onChange({ highlightEnabled: event.target.checked })}
      />

      <Checkbox
        label="Ask the AI automatically when a new word is saved"
        description="Fetch an explanation immediately instead of on demand."
        checked={settings.autoExplainOnSave}
        onChange={(event) => void onChange({ autoExplainOnSave: event.target.checked })}
      />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="highlight-color"
          className="text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          Highlight colour
        </label>
        <div className="flex items-center gap-2">
          <input
            id="highlight-color"
            type="color"
            value={settings.highlightColor}
            onChange={(event) => void onChange({ highlightColor: event.target.value })}
            className="h-9 w-16 cursor-pointer rounded border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 dark:border-slate-700 dark:focus-visible:ring-offset-slate-900"
          />
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {settings.highlightColor}
          </span>
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
