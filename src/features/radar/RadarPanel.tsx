import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalyzePageResult } from './radar-service';
import type { RankedCandidate } from './types';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { useSettings } from '@/shared/hooks/useSettings';
import { useAiAvailable } from '@/shared/hooks/useAiAvailable';
import { sendMessage } from '@/shared/messaging/client';
import { aiErrorMessage } from '@/ai/types';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Button } from '@/shared/ui/Button';
import { TargetIcon, FlameIcon, StarOutlineIcon, SparklesIcon, CheckCheckIcon, RotateCwIcon, SearchIcon, XIcon } from '@/shared/ui/Icons';
import { tints } from '@/shared/styles/tokens';

type ScanState =
  | { status: 'idle' }
  | { status: 'scanning'; done: number; total: number }
  | { status: 'done'; result: AnalyzePageResult }
  | { status: 'empty' }
  | { status: 'error'; message: string };

/** Minimum query length before we trigger a search (avoids noise on single chars). */
const MIN_QUERY_LENGTH = 2;
/** Debounce before firing a search while the user types. */
const SEARCH_DEBOUNCE_MS = 350;

export function RadarPanel() {
  const { settings, update } = useSettings();
  const { available: aiAvailable } = useAiAvailable();
  const [scan, setScan] = useState<ScanState>({ status: 'idle' });
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [currentHost, setCurrentHost] = useState('');

  // Quick Search bar state. Reuses the exact Radar scan pipeline — the query is
  // passed as a one-off goal override, so nothing about the search/AI/result
  // logic is duplicated.
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const goal = settings.radar?.goal ?? '';
  const autoScan = Boolean(settings.radar?.autoScan);

  useEffect(() => {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const url = tabs[0]?.url;
        if (!url) return;
        try {
          setCurrentHost(new URL(url).hostname.replace(/^www\./i, '').toLowerCase());
        } catch {
          /* ignore unparsable urls */
        }
      })
      .catch(() => undefined);
  }, []);

  /**
   * Run a Radar scan against the current page, optionally with a one-off goal
   * override (the Quick Search query). This is the single entry point for both
   * the "Find for my Radar" button and the search bar — existing loading,
   * result, error and empty states are preserved untouched.
   */
  const runScan = useCallback(
    async (goalOverride?: string) => {
      const effectiveGoal = goalOverride?.trim() || goal.trim();
      if (!effectiveGoal || !aiAvailable) return;
      if (!showPrivacy) setShowPrivacy(true);
      setScan({ status: 'scanning', done: 0, total: 0 });
      try {
        // Ask the PAGE to scan itself — it already has the article text and the
        // correct tab context. This fixes the old bug where the background tried
        // to re-query the active tab while the popup was focused (and resolved to
        // the popup window, returning no page text).
        const result = await sendMessage({
          type: 'radar:scan',
          payload: goalOverride?.trim() ? { goal: goalOverride.trim() } : undefined,
        });
        if (!result || result.candidates.length === 0) {
          setScan({ status: 'empty' });
        } else {
          setScan({ status: 'done', result });
          const keys = new Set<string>();
          await Promise.all(
            result.candidates.map(async (c) => {
              const entry = await vocabularyRepository.findByWord(c.text);
              if (entry) keys.add(c.key);
            }),
          );
          setSavedKeys(keys);
        }
      } catch (cause) {
        setScan({ status: 'error', message: aiErrorMessage(cause) });
      }
    },
    [goal, aiAvailable, showPrivacy],
  );

  // Quick Search: debounced live scan using the typed query as the goal.
  useEffect(() => {
    if (debouncedQuery.trim().length < MIN_QUERY_LENGTH) return;
    void runScan(debouncedQuery);
  }, [debouncedQuery, runScan]);

  // Ctrl/Cmd + F focuses the Radar search bar without hijacking the browser's
  // normal find (we don't preventDefault, so the page's own find still works
  // when Radar is not the intended target). Only acts when Radar is usable.
  const onTriggerShortcut = useCallback(() => {
    if (!goal.trim() || !aiAvailable) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [goal, aiAvailable]);

  // Global Ctrl/Cmd + F handler. When Radar is usable, intercept the shortcut
  // and focus the Radar search bar (the browser's built-in find is suppressed).
  // When Radar is not usable (no goal / no AI), we do nothing so the browser's
  // normal find still works.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'f' || event.key === 'F')) {
        const usable = goal.trim().length > 0 && aiAvailable;
        if (!usable) return;
        event.preventDefault();
        onTriggerShortcut();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [goal, aiAvailable, onTriggerShortcut]);

  const ignoreCandidate = useCallback((key: string) => {
    setScan((prev) =>
      prev.status === 'done'
        ? { status: 'done', result: { ...prev.result, candidates: prev.result.candidates.filter((c) => c.key !== key) } }
        : prev,
    );
  }, []);

  const saveCandidate = useCallback(
    async (candidate: RankedCandidate) => {
      await vocabularyRepository.save({
        word: candidate.text,
        sentence: candidate.context ?? '',
        note: candidate.reason,
        tags: ['radar'],
      });
      setSavedKeys((prev) => new Set(prev).add(candidate.key));
    },
    [],
  );

  const explainCandidate = useCallback(
    async (candidate: RankedCandidate) => {
      try {
        await sendMessage({
          type: 'explain',
          payload: {
            word: candidate.text,
            context: candidate.context,
            pageTitle: '',
            language: settings.targetLanguage || 'English',
            kind: 'vocabulary',
          },
        });
      } catch (cause) {
        setScan({ status: 'error', message: aiErrorMessage(cause) });
      }
    },
    [settings.targetLanguage],
  );

  const showResults = scan.status !== 'idle' && !debouncedQuery.trim();

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <TargetIcon size={14} className="text-brand-600" aria-hidden="true" />
        Vocabulary Radar finds words on this page that match your learning goal (set in Settings).
      </p>

      {/* Quick Search bar — a keyboard-first entry point into the existing Radar
          scan. Typing reuses the exact same pipeline; Esc clears/closes. */}
      <div className="relative">
        <SearchIcon
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setQuery('');
              inputRef.current?.blur();
            }
          }}
          placeholder="Search vocabulary…  (Ctrl/Cmd + F)"
          aria-label="Search vocabulary with Vocab Radar"
          title="Type to search with Vocab Radar. Press Ctrl/Cmd + F to focus."
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            <XIcon size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {!goal.trim() && (
        <p className={`rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300`} role="alert">
          Set a Radar goal in Settings to use this feature.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          disabled={!goal.trim() || !aiAvailable || scan.status === 'scanning'}
          onClick={() => void runScan()}
          title={
            !goal.trim()
              ? 'Set a Radar goal in Settings first'
              : !aiAvailable
                ? 'AI actions need an API key in settings'
                : 'Find vocabulary relevant to your Radar goal on this page'
          }
        >
          <TargetIcon size={15} className="mr-1.5" aria-hidden="true" />
          {scan.status === 'scanning' ? 'Finding useful vocabulary…' : 'Find for my Radar'}
        </Button>

        {goal.trim() && !aiAvailable && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AI actions need an API key — open settings.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
              <TargetIcon size={14} className="text-brand-600" aria-hidden="true" />
              Radar auto-find
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {settings.radar?.domains?.length
                ? `On ${settings.radar.domains.length} site${settings.radar.domains.length === 1 ? '' : 's'}`
                : 'On every readable page'}
            </p>
          </div>
          <Button
            size="sm"
            variant={autoScan ? 'primary' : 'secondary'}
            disabled={!goal.trim()}
            onClick={() => void update({ radar: { ...settings.radar, autoScan: !autoScan } })}
          >
            {autoScan ? 'On' : 'Off'}
          </Button>
        </div>

        {autoScan && currentHost && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              Current site: {currentHost}
            </span>
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/50"
              onClick={() => {
                const current = settings.radar?.domains ?? [];
                if (current.includes(currentHost)) return;
                void update({ radar: { ...settings.radar, domains: [...current, currentHost] } });
              }}
            >
              {settings.radar?.domains?.includes(currentHost) ? 'Site included' : 'Only on this site'}
            </button>
          </div>
        )}
        {!goal.trim() && (
          <p className="mt-2 text-[11px] text-slate-400">Set a goal first to enable auto-find.</p>
        )}
      </div>

      {showPrivacy && goal.trim() && !debouncedQuery.trim() && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          To find vocabulary relevant to your goal, selected page content is sent to your configured AI provider.
        </p>
      )}

      {debouncedQuery.trim().length >= MIN_QUERY_LENGTH && (
        <>
          {scan.status === 'scanning' && <ScanningState done={scan.done} total={scan.total} />}
          {scan.status === 'empty' && <EmptyResult />}
          {scan.status === 'error' && <ErrorState message={scan.message} onRetry={() => void runScan(debouncedQuery)} />}
          {scan.status === 'done' && (
            <Results
              result={scan.result}
              savedKeys={savedKeys}
              onExplain={explainCandidate}
              onSave={saveCandidate}
              onIgnore={ignoreCandidate}
            />
          )}
        </>
      )}

      {showResults && (
        <>
          {scan.status === 'scanning' && <ScanningState done={scan.done} total={scan.total} />}
          {scan.status === 'empty' && <EmptyResult />}
          {scan.status === 'error' && <ErrorState message={scan.message} onRetry={() => void runScan()} />}
          {scan.status === 'done' && (
            <Results
              result={scan.result}
              savedKeys={savedKeys}
              onExplain={explainCandidate}
              onSave={saveCandidate}
              onIgnore={ignoreCandidate}
            />
          )}
        </>
      )}
    </div>
  );
}

function ScanningState({ done, total }: { done: number; total: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        <SparklesIcon size={14} className="mr-1.5 inline" aria-hidden="true" />
        Finding useful vocabulary for your Radar…
      </p>
      {total > 1 && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Analyzing article… {done}/{total} sections
        </p>
      )}
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        We couldn’t find enough readable content on this page.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Open an article or long-form page, then try again.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950/40">
      <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
      <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>
        <RotateCwIcon size={13} className="mr-1.5" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}

function Results({
  result,
  savedKeys,
  onExplain,
  onSave,
  onIgnore,
}: {
  result: AnalyzePageResult;
  savedKeys: Set<string>;
  onExplain: (c: RankedCandidate) => void;
  onSave: (c: RankedCandidate) => void;
  onIgnore: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {result.candidates.length} expression{result.candidates.length === 1 ? '' : 's'} found for your goal
        {result.partial && ' (some sections could not be analyzed)'}
      </p>
      {result.candidates.map((c) => (
        <CandidateCard
          key={c.key}
          candidate={c}
          alreadySaved={savedKeys.has(c.key)}
          onExplain={() => onExplain(c)}
          onSave={() => onSave(c)}
          onIgnore={() => onIgnore(c.key)}
        />
      ))}
    </div>
  );
}

function CandidateCard({
  candidate,
  alreadySaved,
  onExplain,
  onSave,
  onIgnore,
}: {
  candidate: RankedCandidate;
  alreadySaved: boolean;
  onExplain: () => void;
  onSave: () => void;
  onIgnore: () => void;
}) {
  const high = candidate.tier === 'high';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        {high ? (
          <FlameIcon size={15} className="shrink-0 text-orange-500" aria-hidden="true" />
        ) : (
          <StarOutlineIcon size={15} className="shrink-0 text-amber-400" aria-hidden="true" />
        )}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{candidate.text}</span>
        <span className="text-[10px] font-semibold uppercase text-slate-400">
          {high ? 'Highly relevant' : 'Relevant'}
        </span>
      </div>
      {candidate.reason && (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{candidate.reason}</p>
      )}
      {candidate.context && (
        <p className="mt-1 line-clamp-2 text-[11px] italic text-slate-400 dark:text-slate-500">
          “{candidate.context}”
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={onExplain}>
          Explain
        </Button>
        {alreadySaved ? (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${tints.successText}`}>
            <CheckCheckIcon size={14} aria-hidden="true" /> Already saved
          </span>
        ) : (
          <Button size="sm" variant="ghost" onClick={onSave}>
            Save
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onIgnore}>
          Ignore
        </Button>
      </div>
    </div>
  );
}
