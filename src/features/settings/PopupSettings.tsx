import type { Settings } from '@/shared/types/settings';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Select } from '@/shared/ui/Select';

export interface PopupSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

const TAB_OPTIONS: ReadonlyArray<{ value: Settings['popupDefaultTab']; label: string }> = [
  { value: 'library', label: 'Library' },
  { value: 'review', label: 'Review' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'progress', label: 'Progress' },
];

export function PopupSettings({ settings, onChange }: PopupSettingsProps) {
  return (
    <section aria-label="Popup" className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Popup</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Control what the popup shows for the word you highlight on a page.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <Checkbox
          label="Auto-translate the highlighted word"
          description="Fetches a keyless translation (no AI key needed) when the popup opens."
          checked={settings.popupShowTranslation}
          onChange={(event) => void onChange({ popupShowTranslation: event.target.checked })}
        />

        <Checkbox
          label="Show the Simplify action"
          description="Adds a one-tap Simplify button. Requires an AI provider key."
          checked={settings.popupShowSimplify}
          onChange={(event) => void onChange({ popupShowSimplify: event.target.checked })}
        />

        <Select
          label="Default tab on open"
          value={settings.popupDefaultTab}
          options={TAB_OPTIONS}
          onChange={(event) =>
            void onChange({
              popupDefaultTab: event.target.value as Settings['popupDefaultTab'],
            })
          }
        />
      </div>
    </section>
  );
}
