import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SelectionPayload } from '@/shared/messaging/contract';
import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { sendMessage } from '@/shared/messaging/client';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useVocabulary } from '@/shared/hooks/useVocabulary';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { Button } from '@/shared/ui/Button';
import { BookIcon, SettingsIcon } from '@/shared/ui/Icons';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { ToastProvider, useToast } from '@/shared/ui/Toast';
import { tints } from '@/shared/styles/tokens';
import { SaveForm } from '@/features/capture/SaveForm';
import { TranslatePanel } from '@/features/capture/TranslatePanel';
import { LibraryList } from '@/features/library/LibraryList';
import { LibraryToolbar, type LibraryFilters } from '@/features/library/LibraryToolbar';

const EMPTY_FILTERS: LibraryFilters = { search: '', favoritesOnly: false, tag: '' };

function LibraryScreen() {
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [saving, setSaving] = useState(false);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const { notify } = useToast();

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
    void (async () => {
      try {
        setSelection(await sendMessage({ type: 'get-selection' }));
      } catch {
        setSelection(null);
      }
    })();
  }, []);

  const handleSave = useCallback(
    async ({ word, note, tags: newTags }: { word: string; note: string; tags: string[] }) => {
      setSaving(true);
      try {
        await vocabularyRepository.save({
          word,
          note,
          tags: newTags,
          sentence: selection?.word === word ? selection.sentence : '',
          sourceUrl: selection?.sourceUrl ?? '',
          sourceTitle: selection?.sourceTitle ?? '',
          sourceLanguage: selection?.sourceLanguage ?? '',
        });
        notify(`Saved “${word}”.`, 'success');
        await reload();
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Could not save that word.', 'error');
      } finally {
        setSaving(false);
      }
    },
    [reload, selection, notify],
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
        notify(cause instanceof Error ? cause.message : 'The AI request failed.', 'error');
      } finally {
        setExplainingId(null);
      }
    },
    [update, notify],
  );

  const isFiltered = Boolean(debouncedSearch || filters.favoritesOnly || filters.tag);

  return (
    <>
      <SaveForm selection={selection} saving={saving} onSave={handleSave} />
      <TranslatePanel selection={selection} />

      {error && (
        <p role="alert" className={`px-3 py-1.5 text-xs ${tints.dangerText}`}>
          {error}
        </p>
      )}

      <LibraryToolbar filters={filters} tags={tags} count={entries.length} onChange={setFilters} />

      {loading ? (
        <SkeletonList rows={4} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<BookIcon size={20} />}
          title={isFiltered ? 'No matches' : 'No words yet'}
          description={
            isFiltered
              ? 'Try a different search term or clear your filters.'
              : 'Select text on any page and use the context menu, Ctrl+Shift+S, or the form above.'
          }
        />
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
        />
      )}
    </>
  );
}

export function App() {
  return (
    <ToastProvider>
      <div className="flex min-h-[420px] w-full min-w-[320px] max-w-[420px] flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
              <SettingsIcon size={14} />
            </span>
            <h1 className="text-sm font-semibold">AI Vocabulary Saver</h1>
          </div>
          <Button size="sm" variant="ghost" onClick={() => chrome.runtime.openOptionsPage()}>
            Settings
          </Button>
        </header>

        <LibraryScreen />
      </div>
    </ToastProvider>
  );
}
