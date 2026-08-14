import { useState } from 'react';
import { Button } from '@/shared/ui/Button';

export interface DomainListEditorProps {
  domains: string[];
  onChange: (domains: string[]) => void;
  /** Label for the list section, e.g. "Reading sites". */
  label: string;
  /** Helper text shown under the label. */
  hint?: string;
}

/** Strip to a registrable-ish hostname (drops www. and path) for matching. */
export function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();
}

/**
 * Single shared editor for the `allowedDomains` list. Both Bilingual settings
 * and Vocabulary Radar auto-find read from this one list, so there is exactly
 * one place to manage where reading aids appear.
 */
export function DomainListEditor({ domains, onChange, label, hint }: DomainListEditorProps): React.ReactElement {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

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
    onChange([...domains, domain]);
  };

  const removeDomain = (domain: string): void => {
    onChange(domains.filter((d) => d !== domain));
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
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
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
          aria-label={label}
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
  );
}
