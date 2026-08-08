import { useId } from 'react';
import type { Settings } from '@/shared/types/settings';
import { LANGUAGES } from '@/storage/settings-repository';
import { TextField } from '@/shared/ui/TextField';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Button } from '@/shared/ui/Button';

export interface BilingualSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

const DEFAULT_PROMPT_HINT =
  'Tokens: {{language}} {{word}} {{context}} {{kind}}. Leave blank to use the built-in prompt.';

export function BilingualSettings({ settings, onChange }: BilingualSettingsProps) {
  const textareaId = useId();
  const languageListId = useId();

  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bilingual mode</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Get explanations and translations in your language, and tune the explain prompt.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <TextField
          label="Target language"
          value={settings.targetLanguage}
          list={languageListId}
          placeholder="e.g. Vietnamese, Spanish, Korean…"
          hint="Any language works — pick a suggestion or type your own."
          onChange={(event) => void onChange({ targetLanguage: event.target.value })}
        />
        <datalist id={languageListId}>
          {LANGUAGES.map((language) => (
            <option key={language} value={language} />
          ))}
        </datalist>

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
