import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sendMessage } from '@/shared/messaging/client';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useVocabulary } from '@/shared/hooks/useVocabulary';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { Button } from '@/shared/ui/Button';
import { SaveForm } from '@/features/capture/SaveForm';
import { LibraryList } from '@/features/library/LibraryList';
import { LibraryToolbar } from '@/features/library/LibraryToolbar';
const EMPTY_FILTERS = { search: '', favoritesOnly: false, tag: '' };
export function App() {
    const [selection, setSelection] = useState(null);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [saving, setSaving] = useState(false);
    const [explainingId, setExplainingId] = useState(null);
    const [status, setStatus] = useState(null);
    const debouncedSearch = useDebouncedValue(filters.search, 250);
    const query = useMemo(() => ({
        search: debouncedSearch,
        favoritesOnly: filters.favoritesOnly,
        tag: filters.tag,
        sortBy: 'createdAt',
        sortDirection: 'desc',
    }), [debouncedSearch, filters.favoritesOnly, filters.tag]);
    const { entries, tags, loading, error, reload, update, remove, toggleFavorite } = useVocabulary(query);
    useEffect(() => {
        void (async () => {
            try {
                setSelection(await sendMessage({ type: 'get-selection' }));
            }
            catch {
                setSelection(null);
            }
        })();
    }, []);
    const handleSave = useCallback(async ({ word, note, tags: newTags }) => {
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
        }
        catch (cause) {
            setStatus({
                message: cause instanceof Error ? cause.message : 'Could not save that word.',
                variant: 'error',
            });
        }
        finally {
            setSaving(false);
        }
    }, [reload, selection]);
    const handleExplain = useCallback(async (entry) => {
        setExplainingId(entry.id);
        setStatus(null);
        try {
            const explanation = await sendMessage({
                type: 'explain',
                payload: { word: entry.word, context: entry.sentence },
            });
            await update(entry.id, { explanation });
        }
        catch (cause) {
            setStatus({
                message: cause instanceof Error ? cause.message : 'The AI request failed.',
                variant: 'error',
            });
        }
        finally {
            setExplainingId(null);
        }
    }, [update]);
    const isFiltered = Boolean(debouncedSearch || filters.favoritesOnly || filters.tag);
    return (_jsxs("div", { className: "flex min-h-[420px] w-full min-w-[320px] max-w-[420px] flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100", children: [_jsxs("header", { className: "flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700", children: [_jsx("h1", { className: "text-sm font-semibold", children: "AI Vocabulary Saver" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => chrome.runtime.openOptionsPage(), children: "Settings" })] }), _jsx(SaveForm, { selection: selection, saving: saving, onSave: handleSave }), (status ?? error) && (_jsx("p", { role: "status", "aria-live": "polite", className: `px-3 py-1.5 text-xs ${status?.variant === 'error' || error
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-700 dark:text-green-400'}`, children: status?.message ?? error })), _jsx(LibraryToolbar, { filters: filters, tags: tags, count: entries.length, onChange: setFilters }), _jsx(LibraryList, { entries: entries, loading: loading, explainingId: explainingId, filtered: isFiltered, onUpdate: update, onDelete: remove, onToggleFavorite: toggleFavorite, onExplain: handleExplain })] }));
}
