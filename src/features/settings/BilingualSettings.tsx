import { useId, useState } from 'react';
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

/** Strip to a registrable-ish hostname (drops www. and path) for matching. */
function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();
}

export function BilingualSettings({ settings, onChange }: BilingualSettingsProps) {
  const textareaId = useId();
  const languageListId = useId();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const domains = settings.bilingualDomains;

  const addDomain = (value: string): void => {
    const domain = normalizeDomain(value);
    if (!domain) {
      setError('Enter a domain, e.g. example.com');
      return;
    }
    if (domains.includes(domain)) {
      setError(`"${domain}" is already in the list`);
      return;
    }
    setError('');
    setDraft('');
    void onChange({ bilingualDomains: [...domains, domain] });
  };

  const removeDomain = (domain: string): void => {
    void onChange({ bilingualDomains: domains.filter((d) => d !== domain) });
  };

  const addCurrentSite = (): void => {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const url = tabs[0]?.url;
        if (!url) {
          setError('No active tab to read the domain from');
          return;
        }
        try {
          addDomain(new URL(url).hostname);
        } catch {
          setError('Could not read the active tab domain');
        }
      })
      .catch(() => setError('Could not read the active tab domain'));
  };

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
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Auto-enable on these domains
          </span>
          <p className="text-[11px] text-slate-400">
            Bilingual mode turns on automatically for these sites, even when the global switch above is
            off. Subdomains are included.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addDomain(draft);
                }
              }}
              placeholder="example.com"
              aria-label="Domain to auto-enable bilingual mode"
              className="min-w-[160px] flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <Button size="sm" variant="secondary" onClick={() => addDomain(draft)}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={addCurrentSite}>
              Add current site
            </Button>
          </div>
          {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
          {domains.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1">
              {domains.map((domain) => (
                <li
                  key={domain}
                  className="flex items-center justify-between gap-2 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span className="truncate">{domain}</span>
                  <button
                    type="button"
                    onClick={() => removeDomain(domain)}
                    aria-label={`Remove ${domain}`}
                    className="rounded px-1 text-slate-500 hover:text-red-600 dark:text-slate-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
