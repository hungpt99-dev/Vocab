import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SelectionPayload } from '@/shared/messaging/contract';
import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { sendMessage } from '@/shared/messaging/client';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useVocabulary } from '@/shared/hooks/useVocabulary';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { Button } from '@/shared/ui/Button';
import { SaveForm } from '@/features/capture/SaveForm';
import { LibraryList } from '@/features/library/LibraryList';
import { LibraryToolbar, type LibraryFilters } from '@/features/library/LibraryToolbar';

const EMPTY_FILTERS: LibraryFilters = { search: '', favoritesOnly: false, tag: '' };

export function App() {
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [saving, setSaving] = useState(false);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

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
        });
        setStatus({ message: `Saved “${word}”.`, variant: 'success' });
        await reload();
      } catch (cause) {
        setStatus({
          message: cause instanceof Error ? cause.message : 'Could not save that word.',
          variant: 'error',
        });
      } finally {
        setSaving(false);
      }
    },
    [reload, selection],
  );

  const handleExplain = useCallback(
    async (entry: VocabularyEntry) => {
      setExplainingId(entry.id);
      setStatus(null);
      try {
        const explanation = await sendMessage({
          type: 'explain',
          payload: { word: entry.word, context: entry.sentence },
        });
        await update(entry.id, { explanation });
      } catch (cause) {
        setStatus({
          message: cause instanceof Error ? cause.message : 'The AI request failed.',
          variant: 'error',
        });
      } finally {
        setExplainingId(null);
      }
    },
    [update],
  );

  const isFiltered = Boolean(debouncedSearch || filters.favoritesOnly || filters.tag);

  return (
    <div className="flex min-h-[420px] w-full min-w-[320px] max-w-[420px] flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <h1 className="text-sm font-semibold">AI Vocabulary Saver</h1>
        <Button size="sm" variant="ghost" onClick={() => chrome.runtime.openOptionsPage()}>
          Settings
        </Button>
      </header>

      <SaveForm selection={selection} saving={saving} onSave={handleSave} />

      {(status ?? error) && (
        <p
          role="status"
          aria-live="polite"
          className={`px-3 py-1.5 text-xs ${
            status?.variant === 'error' || error
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-700 dark:text-green-400'
          }`}
        >
          {status?.message ?? error}
        </p>
      )}

      <LibraryToolbar filters={filters} tags={tags} count={entries.length} onChange={setFilters} />

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
    </div>
  );
}
