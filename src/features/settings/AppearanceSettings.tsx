import { useId } from 'react';
import type { Settings } from '@/shared/types/settings';
import { reading } from '@/shared/styles/tokens';
import { Checkbox } from '@/shared/ui/Checkbox';

export interface AppearanceSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

interface RangeSettingProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

function RangeSetting({ label, value, min, max, step, display, onChange }: RangeSettingProps) {
  const sliderId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={sliderId}
        className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300"
      >
        <span>{label}</span>
        <span className="font-mono text-slate-500 dark:text-slate-400">{display}</span>
      </label>
      <input
        id={sliderId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900"
      />
    </div>
  );
}

export function AppearanceSettings({ settings, onChange }: AppearanceSettingsProps) {
  return (
    <>
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

      <section aria-labelledby="reading-heading" className="flex flex-col gap-4">
        <h2 id="reading-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Reading experience
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Controls the hover card that appears over a saved word while you read. Changes apply to open
          pages instantly.
        </p>

        <Checkbox
          label="Show the original word"
          description="Display the saved word as the heading on the card."
          checked={settings.readingExperience.showOriginal}
          onChange={(event) =>
            void onChange({
              readingExperience: {
                ...settings.readingExperience,
                showOriginal: event.target.checked,
              },
            })
          }
        />

        <Checkbox
          label="Show the translation"
          description="Display the saved meaning on the card."
          checked={settings.readingExperience.showTranslation}
          onChange={(event) =>
            void onChange({
              readingExperience: {
                ...settings.readingExperience,
                showTranslation: event.target.checked,
              },
            })
          }
        />

        <RangeSetting
          label="Translation width"
          value={settings.readingExperience.width}
          min={reading.widthMin}
          max={reading.widthMax}
          step={reading.widthStep}
          display={`${settings.readingExperience.width} px`}
          onChange={(value) =>
            void onChange({ readingExperience: { ...settings.readingExperience, width: value } })
          }
        />

        <RangeSetting
          label="Font size"
          value={settings.readingExperience.fontSize}
          min={reading.fontSizeMin}
          max={reading.fontSizeMax}
          step={reading.fontSizeStep}
          display={`${settings.readingExperience.fontSize} px`}
          onChange={(value) =>
            void onChange({ readingExperience: { ...settings.readingExperience, fontSize: value } })
          }
        />

        <RangeSetting
          label="Spacing"
          value={settings.readingExperience.spacing}
          min={reading.spacingMin}
          max={reading.spacingMax}
          step={reading.spacingStep}
          display={`${settings.readingExperience.spacing.toFixed(1)}×`}
          onChange={(value) =>
            void onChange({ readingExperience: { ...settings.readingExperience, spacing: value } })
          }
        />
      </section>
    </>
  );
}
