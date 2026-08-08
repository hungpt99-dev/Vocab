import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SelectionPayload } from '@/shared/messaging/contract';
import type { ExplainKind } from '@/shared/types/ai';
import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { sendMessage } from '@/shared/messaging/client';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useVocabulary } from '@/shared/hooks/useVocabulary';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { takePendingExplain } from '@/content/pending-explain';
import { isOnboarded } from '@/shared/lib/onboarding';
import { aiErrorMessage } from '@/ai/types';
import { useSettings } from '@/shared/hooks/useSettings';
import { Button } from '@/shared/ui/Button';
import { BookIcon, LanguagesIcon, SettingsIcon, SparklesIcon } from '@/shared/ui/Icons';
import { Switch } from '@/shared/ui/Switch';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { ToastProvider, useToast } from '@/shared/ui/Toast';
import { StatsRow } from '@/shared/ui/StatsRow';
import { OnboardingCoachmark } from '@/shared/ui/OnboardingCoachmark';
import { tints } from '@/shared/styles/tokens';
import { SaveForm } from '@/features/capture/SaveForm';
import { TranslatePanel } from '@/features/capture/TranslatePanel';
import { LibraryList } from '@/features/library/LibraryList';
import { LibraryToolbar, type LibraryFilters } from '@/features/library/LibraryToolbar';
import { ExplanationView } from '@/features/library/ExplanationView';
import type { Explanation } from '@/shared/types/vocabulary';

const EMPTY_FILTERS: LibraryFilters = { search: '', favoritesOnly: false, tag: '' };

/** Contextual AI actions shown under the enrich panel — part of the learning
 * flow, not a separate chat. Each maps to an ExplainKind already supported by
 * the explain service. */
const CONTEXT_ACTIONS: ReadonlyArray<{ kind: ExplainKind; label: string }> = [
  { kind: 'sentence', label: 'Explain sentence' },
  { kind: 'simplify', label: 'Simplify' },
  { kind: 'examples', label: 'Give examples' },
  { kind: 'native', label: 'In my language' },
];

function LibraryScreen({ onVocabularyChanged }: { onVocabularyChanged?: () => void }) {
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [saving, setSaving] = useState(false);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  // Inline enrich for the highlighted word: held in the popup until the word is
  // saved, so the rich AI data is attached on save (no separate popup window).
  const [enrich, setEnrich] = useState<{ word: string; explanation: Explanation } | null>(null);
  const [enriching, setEnriching] = useState(false);
  // The word the user is working with: from a page highlight OR typed into the
  // form. Either way it can be enriched inline before saving.
  const [word, setWord] = useState('');
  const { notify } = useToast();
  const [onboarded, setOnboarded] = useState(true);
  const { settings } = useSettings();

  useEffect(() => {
    void isOnboarded().then((value) => setOnboarded(value));
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

  useEffect(() => {
    const readSelection = (): void => {
      void (async () => {
        try {
          setSelection(await sendMessage({ type: 'get-selection' }));
        } catch {
          setSelection(null);
        }
      })();
    };
    readSelection();
    // Re-read the page selection whenever the popup regains focus, so it always
    // reflects the word the user just highlighted before opening the popup.
    window.addEventListener('focus', readSelection);
    return () => window.removeEventListener('focus', readSelection);
  }, []);

  const handleSave = useCallback(
    async ({ word, note, tags: newTags }: { word: string; note: string; tags: string[] }) => {
      setSaving(true);
      try {
        // Attach any inline enrich data for the highlighted word when it matches.
        const explanation =
          enrich && enrich.word.toLowerCase() === word.toLowerCase() ? enrich.explanation : null;
        await vocabularyRepository.save({
          word,
          note,
          tags: newTags,
          sentence: selection?.word === word ? selection.sentence : '',
          sourceUrl: selection?.sourceUrl ?? '',
          sourceTitle: selection?.sourceTitle ?? '',
          sourceLanguage: selection?.sourceLanguage ?? '',
          explanation,
        });
        if (explanation) setEnrich(null);
        notify(`Saved “${word}”.`, 'success');
        await reload();
        onVocabularyChanged?.();
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Could not save that word.', 'error');
      } finally {
        setSaving(false);
      }
    },
    [reload, selection, notify, enrich, onVocabularyChanged],
  );

  const enrichWord = selection?.word ?? word;

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

  const [explainKind, setExplainKind] = useState<ExplainKind | null>(null);

  const handleExplainKind = useCallback(
    async (kind: ExplainKind) => {
      const target = enrichWord;
      if (!target) return;
      setExplainKind(kind);
      try {
        const explanation = await sendMessage({
          type: 'explain',
          payload: {
            word: target,
            context: selection?.sentence,
            pageTitle: selection?.sourceTitle,
            language: settings.targetLanguage || 'English',
            kind,
          },
        });
        setEnrich({ word: target, explanation });
      } catch (cause) {
        notify(aiErrorMessage(cause), 'error');
      } finally {
        setExplainKind(null);
      }
    },
    [enrichWord, selection, settings.targetLanguage, notify],
  );

  const handleEnrich = useCallback(async () => {
    const target = enrichWord;
    if (!target) return;
    setEnriching(true);
    try {
      const explanation = await sendMessage({
        type: 'explain',
        payload: { word: target, context: selection?.sentence, pageTitle: selection?.sourceTitle },
      });
      setEnrich({ word: target, explanation });
    } catch (cause) {
      notify(aiErrorMessage(cause), 'error');
    } finally {
      setEnriching(false);
    }
  }, [enrichWord, selection, notify]);

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

  // When the page toolbar asks to explain a word, it hands the word off here so
  // the popup is the single explain surface. Explain an existing entry, or save a
  // new one first, then run the explain flow.
  //
  // The pending explain is written to `chrome.storage.local`; we consume it from
  // a storage-change listener (not just a mount effect) so it also fires when the
  // popup is already open — `chrome.action.openPopup()` throws "already open" in
  // that case and is ignored, so a mount-only effect would silently drop the
  // request and the toolbar button would "do nothing". A mount-time catch-up
  // covers the cold-open case (popup opened by the toolbar).
  useEffect(() => {
    let cancelled = false;

    const runPending = async (): Promise<void> => {
      const pending = await takePendingExplain();
      if (!pending || pending.word.trim() === '') return;
      const word = pending.word.trim();
      try {
        let entry = await vocabularyRepository.findByWord(word);
        if (!entry) {
          entry = await vocabularyRepository.save({
            word,
            sentence: pending.context ?? '',
          });
        }
        if (!cancelled) await handleExplain(entry);
      } catch (cause) {
        if (!cancelled) notify(aiErrorMessage(cause), 'error');
      }
    };

    void runPending();
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };

    function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, area: string): void {
      if (area === 'local' && 'avs:pending-explain' in changes) void runPending();
    }
  }, [handleExplain, notify]);

  const isFiltered = Boolean(debouncedSearch || filters.favoritesOnly || filters.tag);

  return (
    <>
      <SaveForm
        selection={selection}
        saving={saving}
        word={word}
        onWordChange={setWord}
        onSave={handleSave}
      />
      <TranslatePanel selection={selection} />

      {enrichWord && (
        <div className="border-b border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {enrichWord}
            </p>
            <Button size="sm" variant="secondary" disabled={enriching} onClick={() => void handleEnrich()}>
              <SparklesIcon size={14} className="mr-1.5" aria-hidden="true" />
              {enriching ? 'Enriching…' : enrich?.word === enrichWord ? 'Re-enrich' : 'AI enrich'}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTEXT_ACTIONS.map((action) => (
              <Button
                key={action.kind}
                size="sm"
                variant="ghost"
                disabled={explainKind !== null}
                onClick={() => void handleExplainKind(action.kind)}
                title={action.label}
              >
                {explainKind === action.kind ? '…' : action.label}
              </Button>
            ))}
          </div>
          {selection?.word === enrichWord && selection.sentence && (
            <p className="mt-0.5 line-clamp-2 text-xs italic text-slate-500 dark:text-slate-400">
              “{selection.sentence}”
            </p>
          )}
          {enrich?.word === enrichWord && (
            <div className="mt-2">
              <ExplanationView explanation={enrich.explanation} />
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className={`px-3 py-1.5 text-xs ${tints.dangerText}`}>
          {error}
        </p>
      )}

      <LibraryToolbar filters={filters} tags={tags} count={entries.length} onChange={setFilters} />

      {loading ? (
        <SkeletonList rows={4} />
      ) : entries.length === 0 ? (
        <>
          {!isFiltered && !onboarded && <OnboardingCoachmark />}
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
          onDelete={remove}
          onToggleFavorite={toggleFavorite}
          onExplain={handleExplain}
          onQuickAdd={handleQuickAdd}
        />
      )}
    </>
  );
}

export function App() {
  const { settings, update } = useSettings();
  const [activating, setActivating] = useState(false);
  const [stats, setStats] = useState<{ total: number; addedToday: number; streak: number } | null>(null);

  const refreshStats = useCallback(() => {
    void vocabularyRepository.stats().then(setStats).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshStats();
    window.addEventListener('focus', refreshStats);
    return () => window.removeEventListener('focus', refreshStats);
  }, [refreshStats]);

  const toggleBilingual = useCallback(
    async (next: boolean) => {
      if (next) setActivating(true);
      try {
        await update({ bilingualMode: next });
      } finally {
        if (next) setActivating(false);
      }
    },
    [update],
  );

  return (
    <ToastProvider>
      <div className="flex min-h-[440px] w-full min-w-[300px] max-w-[400px] flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* App bar */}
        <header className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
              <BookIcon size={16} />
            </span>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">AI Vocabulary Saver</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Read, save, learn</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => chrome.runtime.openOptionsPage()}>
            <SettingsIcon size={14} />
            Settings
          </Button>
        </header>

        {stats && (
          <StatsRow total={stats.total} addedToday={stats.addedToday} streak={stats.streak} />
        )}

        {/* Bilingual reading card — top of the dashboard */}
        <section
          aria-labelledby="bilingual-card-heading"
          className="m-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LanguagesIcon size={16} className="text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <h2 id="bilingual-card-heading" className="text-sm font-semibold">
                Bilingual reading
              </h2>
            </div>
            <Switch
              checked={settings.bilingualMode}
              loading={activating}
              onChange={toggleBilingual}
              label="Bilingual mode"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Show translations inline and read in your language.
          </p>
        </section>

        <LibraryScreen onVocabularyChanged={refreshStats} />
      </div>
    </ToastProvider>
  );
}
