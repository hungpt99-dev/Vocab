import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/shared/hooks/useSettings';
import { sendMessage } from '@/shared/messaging/client';
import { Button } from '@/shared/ui/Button';
import { SearchIcon, TrashIcon, TargetIcon, SparklesIcon } from '@/shared/ui/Icons';
import type { RadarEntryView } from './types';

type RadarState = { status: 'loading' } | { status: 'ready'; items: RadarEntryView[] };

/**
 * Vocab Radar tab — a passive list of generated vocabulary candidates.
 *
 * Radar words are generated from the user's saved & enriched vocabulary (in the
 * background). This tab does NOT search the web or ask AI for discoveries: the
 * search box is a fast, local, deterministic filter over the existing Radar list.
 */
export function RadarPanel() {
  const { settings } = useSettings();
  const [state, setState] = useState<RadarState>({ status: 'loading' });
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const items = ((await sendMessage({ type: 'radar:list' })) as RadarEntryView[]) ?? [];
      setState({ status: 'ready', items });
    } catch {
      setState({ status: 'ready', items: [] });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the list fresh when the background broadcasts a Radar change.
  useEffect(() => {
    const onChange = (message: { type?: string }): void => {
      if (message?.type === 'radar-changed') void load();
    };
    chrome.runtime.onMessage.addListener(onChange);
    return () => chrome.runtime.onMessage.removeListener(onChange);
  }, [load]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = state.status === 'ready' ? state.items ?? [] : [];
    if (!normalizedQuery) return base;
    return base.filter(
      (item) =>
        item.word.toLowerCase().includes(normalizedQuery) ||
        item.reason.toLowerCase().includes(normalizedQuery) ||
        item.sourceWords.some((s) => s.toLowerCase().includes(normalizedQuery)),
    );
  }, [state, normalizedQuery]);

  const onSave = useCallback(
    async (item: RadarEntryView) => {
      await sendMessage({
        type: 'radar:save',
        payload: { word: item.word, wordKey: item.wordKey, sourceLanguage: '' },
      });
      await load();
    },
    [load],
  );

  const onGenerateAll = useCallback(async () => {
    await sendMessage({ type: 'radar:generate-all' });
    await load();
  }, [load]);

  const onRemove = useCallback(
    async (item: RadarEntryView) => {
      await sendMessage({ type: 'radar:remove', payload: { wordKey: item.wordKey } });
      await load();
    },
    [load],
  );

  const items = state.status === 'ready' ? state.items ?? [] : [];

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <TargetIcon size={14} className="text-brand-600" aria-hidden="true" />
        Words related to the vocabulary you're learning — generated from words you save and enrich.
      </p>

      <div className="relative">
        <SearchIcon
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search radar words…"
          aria-label="Search radar words"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {state.status === 'loading' ? (
        <p className="text-xs text-slate-400">Loading your Radar…</p>
      ) : items.length === 0 ? (
        <EmptyState enabled={settings.radar?.enabled ?? true} onGenerate={onGenerateAll} />
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-400">No Radar words match “{query}”.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{item.word}</span>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => void onSave(item)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void onRemove(item)} aria-label={`Remove ${item.word}`}>
                    <TrashIcon size={14} aria-hidden="true" />
                  </Button>
                </div>
              </div>
              {item.sourceWords.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Related to: {item.sourceWords.join(', ')}
                </p>
              )}
              {item.reason && (
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{item.reason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ enabled, onGenerate }: { enabled: boolean; onGenerate: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-900">
      <SparklesIcon size={16} className="mx-auto text-slate-400" aria-hidden="true" />
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {enabled
          ? 'No Radar words yet. Save and enrich a word to grow your Radar.'
          : 'Radar is turned off in Settings.'}
      </p>
      {enabled && (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => void onGenerate()}>
          Generate from saved words
        </Button>
      )}
    </div>
  );
}
