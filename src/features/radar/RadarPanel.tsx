import { useCallback, useEffect, useState } from 'react';
import type { AnalyzePageResult } from './radar-service';
import type { RankedCandidate } from './types';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { useSettings } from '@/shared/hooks/useSettings';
import { useAiAvailable } from '@/shared/hooks/useAiAvailable';
import { sendMessage } from '@/shared/messaging/client';
import { aiErrorMessage } from '@/ai/types';
import { Button } from '@/shared/ui/Button';
import { TargetIcon, FlameIcon, StarOutlineIcon, SparklesIcon, CheckCheckIcon, RotateCwIcon } from '@/shared/ui/Icons';
import { tints } from '@/shared/styles/tokens';

type ScanState =
  | { status: 'idle' }
  | { status: 'scanning'; done: number; total: number }
  | { status: 'done'; result: AnalyzePageResult }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export function RadarPanel() {
  const { settings, update } = useSettings();
  const { available: aiAvailable } = useAiAvailable();
  const [scan, setScan] = useState<ScanState>({ status: 'idle' });
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [currentHost, setCurrentHost] = useState('');

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

  const runScan = useCallback(async () => {
    if (!goal.trim() || !aiAvailable) return;
    if (!showPrivacy) setShowPrivacy(true);
    setScan({ status: 'scanning', done: 0, total: 0 });
    try {
      // Ask the PAGE to scan itself — it already has the article text and the
      // correct tab context. This fixes the old bug where the background tried
      // to re-query the active tab while the popup was focused (and resolved to
      // the popup window, returning no page text).
      const result = await sendMessage({ type: 'radar:scan' });
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
  }, [goal, aiAvailable, showPrivacy]);

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

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <TargetIcon size={14} className="text-brand-600" aria-hidden="true" />
        Vocabulary Radar finds words on this page that match your learning goal (set in Settings).
      </p>

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

      {showPrivacy && goal.trim() && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          To find vocabulary relevant to your goal, selected page content is sent to your configured AI provider.
        </p>
      )}

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
