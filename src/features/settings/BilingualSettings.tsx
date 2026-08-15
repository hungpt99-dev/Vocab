import { useId, useMemo } from 'react';
import type { Settings } from '@/shared/types/settings';
import type { Language } from '@/shared/types/language';
import { asLanguage } from '@/shared/types/language';
import { LANGUAGES } from '@/storage/settings-repository';
import type { SelectOption } from '@/shared/ui/Select';
import { Select } from '@/shared/ui/Select';
import { Button } from '@/shared/ui/Button';
import { DomainListEditor } from './DomainListEditor';

export interface BilingualSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

const DEFAULT_PROMPT_HINT =
  'Tokens: {{language}} {{word}} {{context}} {{kind}}. Leave blank to use the built-in prompt.';

interface TargetLanguageSelectProps {
  value: Language;
  onChange: (value: Language) => void;
}

function TargetLanguageSelect({ value, onChange }: TargetLanguageSelectProps) {
  const options = useMemo<readonly SelectOption[]>(() => {
    const known = LANGUAGES.map((language) => ({ value: language.code, label: language.name }));
    // Include a custom (out-of-list) value so it remains selectable.
    if (value && !known.some((option) => option.value === value.code)) {
      return [...known, { value: value.code, label: `${value.name} (custom)` }];
    }
    return known;
  }, [value]);

  return (
    <Select
      label="Target language"
      options={options}
      hint="Pick the language you want explanations and translations in."
      value={value.code}
      onChange={(event) => {
        const code = event.target.value;
        const builtIn = LANGUAGES.find((language) => language.code === code);
        onChange(builtIn ?? asLanguage(code));
      }}
    />
  );
}

const READING_MODES: ReadonlyArray<{ value: Settings['readingMode']; label: string; hint: string }> = [
  { value: 'off', label: 'Off', hint: 'No inline translations or Radar auto-find.' },
  { value: 'allowed', label: 'Allowed sites', hint: 'Translations + Radar auto-find on your reading sites only.' },
  { value: 'everywhere', label: 'Everywhere', hint: 'Translations + Radar auto-find on every page.' },
];

export function BilingualSettings({ settings, onChange }: BilingualSettingsProps) {
  const textareaId = useId();

  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reading</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Get explanations and translations in your language, and choose where reading aids appear. This single
        scope also drives Vocabulary Radar auto-find.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <TargetLanguageSelect value={settings.targetLanguage} onChange={(value) => void onChange({ targetLanguage: value })} />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Reading mode</span>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {READING_MODES.map((mode) => {
              const active = settings.readingMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => void onChange({ readingMode: mode.value })}
                  title={mode.hint}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400">
            {READING_MODES.find((m) => m.value === settings.readingMode)?.hint}
          </p>
        </div>

        {settings.readingMode === 'allowed' && (
          <DomainListEditor
            domains={settings.allowedDomains}
            onChange={(allowedDomains) => void onChange({ allowedDomains })}
            label="Reading sites"
            hint="Reading aids turn on for these sites only. Subdomains are included. Manage this list once — it is shared by Bilingual and Radar."
          />
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={textareaId} className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Explain prompt
          </label>
          <textarea
            id={textareaId}
            rows={6}
            className="w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder={DEFAULT_PROMPT_HINT}
            value={settings.explainPromptTemplate}
            onChange={(event) => void onChange({ explainPromptTemplate: event.target.value })}
          />
          <p className="text-[11px] text-slate-400">{DEFAULT_PROMPT_HINT}</p>
          <div>
            <Button size="sm" variant="secondary" onClick={() => void onChange({ explainPromptTemplate: '' })}>
              Reset to default
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
