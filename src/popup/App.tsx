import { useCallback, useEffect, useMemo, useState } from 'react';
import type { VocabularyEntry } from '@/shared/types/vocabulary';
import type { LibraryFilters } from '@/features/library/LibraryToolbar';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { reviewRepository } from '@/storage/review-repository';
import { isOnboarded } from '@/shared/lib/onboarding';
import { sendMessage, sendToActiveTab } from '@/shared/messaging/client';
import { aiErrorMessage } from '@/ai/types';
import { useSettings } from '@/shared/hooks/useSettings';
import { Button } from '@/shared/ui/Button';
import { BookIcon, GithubIcon, PlusIcon, RotateCwIcon, SettingsIcon, TargetIcon, UsersIcon } from '@/shared/ui/Icons';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { ToastProvider, useToast } from '@/shared/ui/Toast';
import { StatsRow } from '@/shared/ui/StatsRow';
import { OnboardingCoachmark } from '@/shared/ui/OnboardingCoachmark';
import { tints } from '@/shared/styles/tokens';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useVocabulary } from '@/shared/hooks/useVocabulary';
import { LibraryList } from '@/features/library/LibraryList';
import { LibraryToolbar } from '@/features/library/LibraryToolbar';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { QuizScreen } from '@/features/quiz/QuizScreen';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import { RadarPanel } from '@/features/radar/RadarPanel';
import { SaveWordScreen } from '@/features/capture/SaveWordScreen';

const EMPTY_FILTERS: LibraryFilters = { search: '', favoritesOnly: false, tag: '' };

function LibraryScreen({
  onVocabularyChanged,
  onAddWord,
}: {
  onVocabularyChanged?: () => void;
  onAddWord: () => void;
}) {
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const { notify } = useToast();
  const [onboarded, setOnboarded] = useState(true);
  const { settings } = useSettings();
  const [tab, setTab] = useState<'library' | 'radar' | 'review' | 'quiz' | 'progress'>(settings.popupDefaultTab);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    void isOnboarded().then((value) => setOnboarded(value));
    void reviewRepository.dueCount().then(setDueCount);
  }, []);

  const debouncedSearch = useDebouncedValue(filters.search, 250);
  const query = useMemo(
    () => ({
      search: debouncedSearch,
      favoritesOnly: filters.favoritesOnly,
      tag: filters.tag,
      sortBy: 'createdAt' as const,
      sortDirection: 'desc' as const,
    }),
    [debouncedSearch, filters.favoritesOnly, filters.tag],
  );

  const { entries, tags, loading, error, reload, update, remove, toggleFavorite } = useVocabulary(query);

  const handleRemove = useCallback(
    async (id: string) => {
      await remove(id);
      await reviewRepository.remove(id).catch(() => undefined);
    },
    [remove],
  );

  const handleQuickAdd = useCallback(
    async (related: string) => {
      const word = related.trim();
      if (!word) return;
      try {
        await vocabularyRepository.save({ word });
        await reload();
        onVocabularyChanged?.();
        notify(`Saved “${word}”.`, 'success');
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Could not save that word.', 'error');
      }
    },
    [reload, onVocabularyChanged, notify],
  );

  const handleExplain = useCallback(
    async (entry: VocabularyEntry) => {
      setExplainingId(entry.id);
      try {
        const explanation = await sendMessage({
          type: 'explain',
          payload: { word: entry.word, context: entry.sentence, pageTitle: entry.sourceTitle },
        });
        await update(entry.id, { explanation });
      } catch (cause) {
        notify(aiErrorMessage(cause), 'error');
      } finally {
        setExplainingId(null);
      }
    },
    [update, notify],
  );

  const isFiltered = Boolean(debouncedSearch || filters.favoritesOnly || filters.tag);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Adding a word is an explicit action — a single prominent button
          replaces the inline save form. The full form lives on its own page. */}
      <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-700">
        <Button
          variant="primary"
          className="w-full justify-center py-2.5 text-sm font-semibold"
          onClick={onAddWord}
        >
          <PlusIcon size={16} className="mr-1.5" aria-hidden="true" />
          Save new word
        </Button>
      </div>

      {error && (
        <p role="alert" className={`px-3 py-1.5 text-xs ${tints.dangerText}`}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-1.5 border-b border-slate-200 px-5 py-2 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setTab('library')}
          className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
            tab === 'library'
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Library
        </button>
        <button
          type="button"
          onClick={() => setTab('review')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium ${
            tab === 'review'
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Review
          {dueCount > 0 && (
            <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">
              {dueCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('quiz')}
          className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
            tab === 'quiz'
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Quiz
        </button>
        <button
          type="button"
          onClick={() => setTab('progress')}
          className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
            tab === 'progress'
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Progress
        </button>
        <button
          type="button"
          onClick={() => setTab('radar')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium ${
            tab === 'radar'
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <TargetIcon size={14} className="shrink-0" aria-hidden="true" />
          Radar
        </button>
      </div>

      {tab === 'radar' ? (
        <RadarPanel />
      ) : tab === 'progress' ? (
        <ProgressScreen />
      ) : tab === 'quiz' ? (
        <QuizScreen />
      ) : tab === 'review' ? (
        <ReviewScreen />
      ) : (
        <>
          <div className="shrink-0">
            <LibraryToolbar filters={filters} tags={tags} count={entries.length} onChange={setFilters} />
          </div>

          {loading ? (
            <SkeletonList rows={4} />
          ) : entries.length === 0 ? (
            <>
              {!isFiltered && !onboarded && (
                <OnboardingCoachmark onStartSaving={onAddWord} />
              )}
              <EmptyState
                icon={<BookIcon size={20} />}
                title={isFiltered ? 'No matches' : 'No words yet'}
                description={
                  isFiltered
                    ? 'Try a different search term or clear your filters.'
                    : 'Highlight any word on a page, then open this popup to save it or get an AI explanation. Your vocabulary builds as you read.'
                }
              />
            </>
          ) : (
            <LibraryList
              entries={entries}
              loading={loading}
              explainingId={explainingId}
              filtered={isFiltered}
              onUpdate={update}
              onDelete={handleRemove}
              onToggleFavorite={toggleFavorite}
              onExplain={handleExplain}
              onQuickAdd={handleQuickAdd}
            />
          )}
        </>
      )}
    </div>
  );
}

export function App() {
  const { settings, update } = useSettings();
  const [view, setView] = useState<'dashboard' | 'save'>('dashboard');
  const [stats, setStats] = useState<{ total: number; addedToday: number; streak: number } | null>(null);
  // Hostname of the active tab, used to reflect/steer the per-site reading scope.
  const [currentHost, setCurrentHost] = useState('');


  const refreshStats = useCallback(() => {
    void vocabularyRepository.stats().then(setStats).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshStats();
    window.addEventListener('focus', refreshStats);
    return () => window.removeEventListener('focus', refreshStats);
  }, [refreshStats]);

  // Track the active tab's hostname so the reading-mode control can reflect and
  // steer the per-site scope of the shared 'allowed' mode. From a popup window,
  // `currentWindow` is the popup itself (a chrome-extension:// URL), so query
  // `lastFocusedWindow` to resolve the page the user is actually looking at.
  useEffect(() => {
    let cancelled = false;
    void chrome.tabs
      .query({ active: true, lastFocusedWindow: true })
      .then((tabs) => {
        const url = tabs[0]?.url;
        if (cancelled || !url) return;
        try {
          setCurrentHost(new URL(url).hostname.replace(/^www\./i, '').toLowerCase());
        } catch {
          /* ignore unparsable urls (e.g. chrome://) */
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const currentHostInAllowed = currentHost
    ? (settings.allowedDomains ?? []).includes(currentHost)
    : false;

  const [refreshingTranslation, setRefreshingTranslation] = useState(false);

  // Re-translate the current page's bilingual content, bypassing the session
  // cache. Sent to the active tab's content script, which owns the reader.
  // Failures surface on the page itself (the reader shows a banner), so the
  // popup only manages the button's pending state here.
  const refreshPageTranslation = useCallback(async () => {
    setRefreshingTranslation(true);
    try {
      // Route to the active tab's content script, which owns the reader. (Do NOT
      // use sendMessage — that hits the background worker, where bilingual:refresh
      // is not registered, and the call fails silently.)
      await sendToActiveTab({ type: 'bilingual:refresh', force: true });
    } catch {
      // The content script reports translation failures via its own banner.
    } finally {
      setRefreshingTranslation(false);
    }
  }, []);

  const addCurrentSiteToAllowed = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url;
    if (!url) return;
    let hostname: string;
    try {
      hostname = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
      return;
    }
    if (!hostname) return;
    const current = settings.allowedDomains ?? [];
    const nextDomains = current.includes(hostname) ? current : [...current, hostname];
    // Adding a site implies at least 'allowed' scope so it actually takes effect.
    await update({
      allowedDomains: nextDomains,
      readingMode: settings.readingMode === 'off' ? 'allowed' : settings.readingMode,
    });
  }, [settings.allowedDomains, settings.readingMode, update]);

  const removeCurrentSiteFromAllowed = useCallback(async () => {
    const host = currentHost;
    if (!host) return;
    const current = settings.allowedDomains ?? [];
    await update({ allowedDomains: current.filter((domain) => domain !== host) });
  }, [currentHost, settings.allowedDomains, update]);

  return (
    <ToastProvider>
      <div className="flex min-h-[480px] max-h-[600px] w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* App bar: brand | auto site + bilingual | settings */}
        <header className="border-b border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900">
          {/* Row 1 — brand + settings */}
          <div className="flex items-center justify-between gap-4 px-7 pb-2 pt-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm">
                <img
                  src={chrome.runtime.getURL('assets/icon128.png')}
                  alt=""
                  className="h-full w-full object-cover"
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0 leading-tight">
                <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Vocab
                </h1>
                <p className="max-[380px]:hidden truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  Save&nbsp;•&nbsp;Learn&nbsp;•&nbsp;Remember
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              className="h-9 w-9 shrink-0 rounded-lg p-0"
              onClick={() => chrome.runtime.openOptionsPage()}
              title="Settings"
              aria-label="Settings"
            >
              <SettingsIcon size={18} className="shrink-0" aria-hidden="true" />
            </Button>
          </div>

          {/* Row 2 — unified reading-mode control (Bilingual + Radar scope) */}
          <div className="flex items-center justify-center gap-2 border-t border-slate-100 px-7 py-2 dark:border-slate-800">
            <div
              className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
              role="radiogroup"
              aria-label="Reading mode"
            >
              {(
                [
                  { value: 'off' as const, label: 'Off' },
                  { value: 'allowed' as const, label: 'Allowed sites' },
                  { value: 'everywhere' as const, label: 'Everywhere' },
                ]
              ).map((option) => {
                const active = settings.readingMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => void update({ readingMode: option.value })}
                    title={
                      option.value === 'off'
                        ? 'No inline translations or Radar auto-find'
                        : option.value === 'allowed'
                          ? 'Translations + Radar auto-find on your allowed sites only'
                          : 'Translations + Radar auto-find on every page'
                    }
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {/* Add the current site to the allowed list (only meaningful in 'allowed' mode). */}
            <button
              type="button"
              onClick={() =>
                currentHostInAllowed ? void removeCurrentSiteFromAllowed() : void addCurrentSiteToAllowed()
              }
              disabled={!currentHost}
              title={
                !currentHost
                  ? 'No active site to add'
                  : currentHostInAllowed
                    ? `Remove ${currentHost} from allowed sites`
                    : `Add ${currentHost} to allowed sites`
              }
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-base font-semibold transition-colors ${
                currentHostInAllowed
                  ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-900/60 dark:text-brand-200'
                  : 'border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400'
              } ${!currentHost ? 'cursor-not-allowed opacity-50' : ''}`}
              aria-label={
                currentHostInAllowed ? 'Remove current site from allowed sites' : 'Add current site to allowed sites'
              }
            >
              {currentHostInAllowed ? '−' : '+'}
            </button>

            {/* Re-translate the current page's bilingual content, bypassing the
                session cache. Disabled when there's no active site or Bilingual
                is off (nothing on the page to refresh). */}
            <button
              type="button"
              onClick={() => void refreshPageTranslation()}
              disabled={!currentHost || settings.readingMode === 'off' || refreshingTranslation}
              title={
                !currentHost
                  ? 'No active site to refresh'
                  : settings.readingMode === 'off'
                    ? 'Turn on Bilingual reading to use this'
                    : 'Re-translate this page (bypass cache)'
              }
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-base font-semibold transition-colors ${
                !currentHost || settings.readingMode === 'off'
                  ? 'cursor-not-allowed border-slate-200 text-slate-400 opacity-50 dark:border-slate-700 dark:text-slate-500'
                  : 'border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400'
              }`}
              aria-label="Re-translate this page"
            >
              <RotateCwIcon size={14} className={refreshingTranslation ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </header>

        {stats && (
          <StatsRow total={stats.total} addedToday={stats.addedToday} streak={stats.streak} />
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === 'save' ? (
            <SaveWordScreen
              onSaved={refreshStats}
              onBack={() => setView('dashboard')}
            />
          ) : (
            <LibraryScreen onVocabularyChanged={refreshStats} onAddWord={() => setView('save')} />
          )}
        </div>

        <footer className="flex items-center justify-center gap-1 border-t border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
          <a
            href="https://github.com/hungpt99-dev"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <GithubIcon size={13} aria-hidden="true" />
            About me
          </a>
          <a
            href="https://github.com/hungpt99-dev/awesome-books"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <BookIcon size={13} aria-hidden="true" />
            Book
          </a>
          <a
            href="https://github.com/hungpt99-dev/vocab"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <UsersIcon size={13} aria-hidden="true" />
            Community
          </a>
        </footer>
      </div>
    </ToastProvider>
  );
}
