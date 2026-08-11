import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnalyzePageResult } from './goal-service';
import type { RankedCandidate, VocabularyGoal } from './types';
import { goalRepository } from '@/storage/goal-repository';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { useSettings } from '@/shared/hooks/useSettings';
import { useAiAvailable } from '@/shared/hooks/useAiAvailable';
import { sendMessage } from '@/shared/messaging/client';
import { aiErrorMessage } from '@/ai/types';
import { Button } from '@/shared/ui/Button';
import { Switch } from '@/shared/ui/Switch';
import { TargetIcon, FlameIcon, StarOutlineIcon, SparklesIcon, PencilIcon, TrashIcon, CheckCheckIcon, RotateCwIcon } from '@/shared/ui/Icons';
import { tints } from '@/shared/styles/tokens';

type ScanState =
  | { status: 'idle' }
  | { status: 'scanning'; done: number; total: number }
  | { status: 'done'; result: AnalyzePageResult }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export function GoalModeScreen() {
  const { settings, update } = useSettings();
  const { available: aiAvailable } = useAiAvailable();
  const [goals, setGoals] = useState<VocabularyGoal[]>([]);
  const [editing, setEditing] = useState<VocabularyGoal | null>(null);
  const [draftText, setDraftText] = useState('');
  const [composing, setComposing] = useState(false);
  const [scan, setScan] = useState<ScanState>({ status: 'idle' });
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [currentHost, setCurrentHost] = useState('');

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

  const activeGoal = useMemo(
    () => goals.find((g) => g.id === settings.activeGoalId) ?? null,
    [goals, settings.activeGoalId],
  );

  const reloadGoals = useCallback(async () => {
    setGoals(await goalRepository.list());
  }, []);

  useEffect(() => {
    void reloadGoals();
  }, [reloadGoals]);

  const saveGoal = useCallback(async () => {
    const text = draftText.trim();
    if (!text) return;
    setComposing(true);
    try {
      if (editing) {
        await goalRepository.update(editing.id, { text });
      } else {
        const created = await goalRepository.create({ text });
        // First goal created becomes the active goal automatically.
        if (!settings.activeGoalId) await update({ activeGoalId: created.id });
      }
      setDraftText('');
      setEditing(null);
      await reloadGoals();
    } finally {
      setComposing(false);
    }
  }, [draftText, editing, settings.activeGoalId, update, reloadGoals]);

  const removeGoal = useCallback(
    async (goal: VocabularyGoal) => {
      await goalRepository.remove(goal.id);
      if (settings.activeGoalId === goal.id) await update({ activeGoalId: undefined });
      await reloadGoals();
    },
    [settings.activeGoalId, update, reloadGoals],
  );

  const selectActive = useCallback(
    async (id: string) => {
      await update({ activeGoalId: id });
    },
    [update],
  );

  const runScan = useCallback(async () => {
    if (!activeGoal || !aiAvailable) return;
    if (!showPrivacy) setShowPrivacy(true);
    setScan({ status: 'scanning', done: 0, total: 0 });
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const pageUrl = tab?.url ?? '';
      const result = await sendMessage({
        type: 'analyze-goal-page',
        payload: { goalId: activeGoal.id, pageUrl },
      });
      if (!result || result.candidates.length === 0) {
        setScan({ status: 'empty' });
      } else {
        setScan({ status: 'done', result });
        // Refresh "already saved" badges for the new candidates.
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
  }, [activeGoal, aiAvailable, showPrivacy]);

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
        tags: ['goal'],
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
        // Reuse the popup's pending-explain handoff so the explanation opens there.
      } catch (cause) {
        setScan({ status: 'error', message: aiErrorMessage(cause) });
      }
    },
    [settings.targetLanguage],
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Goal manager */}
      <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <header className="mb-2 flex items-center gap-2">
          <TargetIcon size={16} className="text-brand-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {editing ? 'Edit goal' : 'My current goal'}
          </h2>
        </header>

        {activeGoal && !editing && (
          <div className="mb-2 rounded-md bg-brand-50 px-3 py-2 dark:bg-brand-900/50">
            <p className="text-sm text-slate-800 dark:text-slate-100">{activeGoal.text}</p>
            <button
              type="button"
              className="mt-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
              onClick={() => {
                setEditing(activeGoal);
                setDraftText(activeGoal.text);
              }}
            >
              Change goal
            </button>
          </div>
        )}

        {(editing || goals.length === 0) && (
          <div className="flex flex-col gap-2">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={2}
              placeholder="e.g. Improve my English for backend engineering and technical communication"
              className="w-full resize-none rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={!draftText.trim() || composing} onClick={() => void saveGoal()}>
                {editing ? 'Save changes' : 'Add goal'}
              </Button>
              {editing && (
                <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setDraftText(''); }}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {goals.length > 1 && (
          <ul className="mt-2 flex flex-col gap-1">
            {goals
              .filter((g) => g.id !== activeGoal?.id)
              .map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    className="truncate text-left text-slate-600 hover:text-brand-600 dark:text-slate-300"
                    onClick={() => void selectActive(g.id)}
                    title="Set as active goal"
                  >
                    {g.text}
                  </button>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" className="text-slate-400 hover:text-slate-600" title="Edit" onClick={() => { setEditing(g); setDraftText(g.text); }}>
                      <PencilIcon size={13} aria-hidden="true" />
                    </button>
                    <button type="button" className="text-slate-400 hover:text-red-500" title="Delete" onClick={() => void removeGoal(g)}>
                      <TrashIcon size={13} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Scan action */}
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          disabled={!activeGoal || !aiAvailable || scan.status === 'scanning'}
          onClick={() => void runScan()}
          title={
            !activeGoal
              ? 'Set a goal first'
              : !aiAvailable
                ? 'AI actions need an API key in settings'
                : 'Find vocabulary relevant to your goal on this page'
          }
        >
          <TargetIcon size={15} className="mr-1.5" aria-hidden="true" />
          {scan.status === 'scanning' ? 'Finding useful vocabulary…' : 'Find vocabulary for my goal'}
        </Button>

        {!activeGoal && (
          <p className={`text-xs ${tints.dangerText}`} role="alert">
            Set a learning goal first to discover vocabulary relevant to you.
          </p>
        )}
        {activeGoal && !aiAvailable && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AI actions need an API key — open settings.
          </p>
        )}
      </div>

      {/* Auto-scan toggle — mirrors the Auto-site pattern; reuses the domain list. */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
              <TargetIcon size={14} className="text-brand-600" aria-hidden="true" />
              Auto-find on pages
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {settings.goalMode?.domains?.length
                ? `On ${settings.goalMode.domains.length} site${settings.goalMode.domains.length === 1 ? '' : 's'}`
                : 'On every readable page'}
            </p>
          </div>
          <Switch
            checked={Boolean(settings.goalMode?.autoScan)}
            disabled={!settings.activeGoalId}
            loading={false}
            onChange={(next) => void update({ goalMode: { ...settings.goalMode, autoScan: next } })}
            label="Auto-find vocabulary for your goal"
          />
        </div>

        {settings.goalMode?.autoScan && settings.activeGoalId && currentHost && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              Current site: {currentHost}
            </span>
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/50"
              onClick={() => {
                const current = settings.goalMode?.domains ?? [];
                if (current.includes(currentHost)) return;
                void update({ goalMode: { ...settings.goalMode, domains: [...current, currentHost] } });
              }}
            >
              {settings.goalMode?.domains?.includes(currentHost) ? 'Site included' : 'Only on this site'}
            </button>
          </div>
        )}
        {!settings.activeGoalId && (
          <p className="mt-2 text-[11px] text-slate-400">Set a goal first to enable auto-find.</p>
        )}
      </div>

      {showPrivacy && activeGoal && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          To find vocabulary relevant to your goal, selected page content is sent to your
          configured AI provider.
        </p>
      )}

      {/* Scan states */}
      {scan.status === 'scanning' && (
        <ScanningState done={scan.done} total={scan.total} />
      )}
      {scan.status === 'empty' && (
        <EmptyResult />
      )}
      {scan.status === 'error' && (
        <ErrorState message={scan.message} onRetry={() => void runScan()} />
      )}
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
        Finding useful vocabulary for your goal…
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
