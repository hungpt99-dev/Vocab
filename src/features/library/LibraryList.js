import { jsx as _jsx } from "react/jsx-runtime";
import { EmptyState } from '@/shared/ui/EmptyState';
import { Spinner } from '@/shared/ui/Spinner';
import { EntryCard } from './EntryCard';
export function LibraryList({ entries, loading, explainingId, filtered, onUpdate, onDelete, onToggleFavorite, onExplain, }) {
    if (loading) {
        return (_jsx("div", { className: "p-4", children: _jsx(Spinner, { label: "Loading your vocabulary\u2026" }) }));
    }
    if (entries.length === 0) {
        return filtered ? (_jsx(EmptyState, { title: "No matches", description: "Try a different search term or clear your filters." })) : (_jsx(EmptyState, { title: "No words yet", description: "Select text on any page and use the context menu, Ctrl+Shift+S, or the form above." }));
    }
    return (_jsx("ul", { className: "avs-scroll max-h-80 overflow-y-auto", children: entries.map((entry) => (_jsx(EntryCard, { entry: entry, explaining: explainingId === entry.id, onUpdate: onUpdate, onDelete: onDelete, onToggleFavorite: onToggleFavorite, onExplain: onExplain }, entry.id))) }));
}
