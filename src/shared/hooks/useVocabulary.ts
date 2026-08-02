import { useCallback, useEffect, useMemo, useState } from 'react';
import type { VocabularyEntry, VocabularyQuery, VocabularyPatch } from '@/shared/types/vocabulary';
import { vocabularyRepository } from '@/storage/vocabulary-repository';

export interface UseVocabularyResult {
  entries: VocabularyEntry[];
  tags: string[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  update: (id: string, patch: VocabularyPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}

/**
 * Query vocabulary with optimistic mutations. Mutations update local state
 * first and roll back by reloading when persistence fails.
 */
export function useVocabulary(query: VocabularyQuery): UseVocabularyResult {
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = useMemo(() => JSON.stringify(query), [query]);

  const reload = useCallback(async () => {
    try {
      const parsed = JSON.parse(key) as VocabularyQuery;
      const [list, tagList] = await Promise.all([
        vocabularyRepository.list(parsed),
        vocabularyRepository.listTags(),
      ]);
      setEntries(list);
      setTags(tagList);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your vocabulary.');
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Refresh whenever another surface reports a change.
  useEffect(() => {
    const listener = (message: unknown): void => {
      if ((message as { type?: string })?.type === 'vocabulary-changed') void reload();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [reload]);

  const applyOptimistic = useCallback(
    async (id: string, optimistic: (entry: VocabularyEntry) => VocabularyEntry, persist: () => Promise<unknown>) => {
      setEntries((current) => current.map((entry) => (entry.id === id ? optimistic(entry) : entry)));
      try {
        await persist();
        await reload();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save that change.');
        await reload();
      }
    },
    [reload],
  );

  const update = useCallback(
    (id: string, patch: VocabularyPatch) =>
      applyOptimistic(id, (entry) => ({ ...entry, ...patch }), () =>
        vocabularyRepository.update(id, patch),
      ),
    [applyOptimistic],
  );

  const toggleFavorite = useCallback(
    (id: string) =>
      applyOptimistic(id, (entry) => ({ ...entry, favorite: !entry.favorite }), () =>
        vocabularyRepository.toggleFavorite(id),
      ),
    [applyOptimistic],
  );

  const remove = useCallback(
    async (id: string) => {
      setEntries((current) => current.filter((entry) => entry.id !== id));
      try {
        await vocabularyRepository.remove(id);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not delete that entry.');
      }
      await reload();
    },
    [reload],
  );

  return { entries, tags, loading, error, reload, update, remove, toggleFavorite };
}
