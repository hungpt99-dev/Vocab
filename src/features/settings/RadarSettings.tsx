import { useId, useState } from 'react';
import type { Settings } from '@/shared/types/settings';
import { isRadarEnabled } from '@/shared/types/settings';

export interface RadarSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

/** Strip to a registrable-ish hostname (drops www. and path) for matching. */
function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();
}

/**
 * Vocabulary Radar settings. The learning goal is a free-text field (the source
 * of truth), and auto-find reuses the exact per-domain pattern from Bilingual.
 */
export function RadarSettings({ settings, onChange }: RadarSettingsProps) {
  const textareaId = useId();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const radar = settings.radar;
  const goal = radar?.goal ?? '';
  const autoScan = Boolean(radar?.autoScan);
  const domains = radar?.domains ?? [];

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
    void onChange({ radar: { ...radar, domains: [...domains, domain] } });
  };

  const removeDomain = (domain: string): void => {
    void onChange({ radar: { ...radar, domains: domains.filter((d) => d !== domain) } });
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
            onChange={(event) => void onChange({ radar: { ...radar, goal: event.target.value } })}
          />
          <p className="text-[11px] text-slate-400">
            This goal is sent to your AI provider when Radar scans a page.
          </p>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Auto-find on pages
            <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
              Highlight goal-relevant words automatically while you read.
            </span>
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={autoScan}
            disabled={!goal.trim()}
            onChange={(event) => void onChange({ radar: { ...radar, autoScan: event.target.checked } })}
          />
        </label>

        {autoScan && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Auto-find only on these domains
            </span>
            <p className="text-[11px] text-slate-400">
              When empty, Radar auto-finds on every readable page. Subdomains are included.
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
                aria-label="Domain to auto-enable Radar"
                className="min-w-[160px] flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                onClick={() => addDomain(draft)}
              >
                Add
              </button>
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={addCurrentSite}
              >
                Add current site
              </button>
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
        )}

        {!isRadarEnabled(settings) && (
          <p className="text-[11px] text-slate-400">
            Set a goal and enable auto-find (or use “Find for my Radar” in the popup) to start.
          </p>
        )}
      </div>
    </section>
  );
}
