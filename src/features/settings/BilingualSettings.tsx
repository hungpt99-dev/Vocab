import { useId } from 'react';
import type { Settings } from '@/shared/types/settings';
import { LANGUAGES } from '@/storage/settings-repository';
import { Select } from '@/shared/ui/Select';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Button } from '@/shared/ui/Button';

export interface BilingualSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

const LANGUAGE_OPTIONS = LANGUAGES.map((language) => ({ value: language, label: language }));

const DEFAULT_PROMPT_HINT =
  'Tokens: {{language}} {{word}} {{context}} {{kind}}. Leave blank to use the built-in prompt.';

export function BilingualSettings({ settings, onChange }: BilingualSettingsProps) {
  const textareaId = useId();

  return (
    <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bilingual mode</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Get explanations and translations in your language, and tune the explain prompt.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <Select
          label="Target language"
          options={LANGUAGE_OPTIONS}
          value={settings.targetLanguage}
          onChange={(event) => void onChange({ targetLanguage: event.target.value })}
        />

        <Checkbox
          label="Bilingual mode (show translations inline)"
          checked={settings.bilingualMode}
          onChange={(event) => void onChange({ bilingualMode: event.target.checked })}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={textareaId}
            className="text-xs font-medium text-slate-600 dark:text-slate-300"
          >
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
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void onChange({ explainPromptTemplate: '' })}
            >
              Reset to default
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
