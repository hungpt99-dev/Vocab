import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Spinner } from '@/shared/ui/Spinner';
import { TagInput } from '@/shared/ui/TagInput';
import { TextField } from '@/shared/ui/TextField';
import { ExplanationView } from './ExplanationView';
export function EntryCard({ entry, explaining, onUpdate, onDelete, onToggleFavorite, onExplain, }) {
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [draft, setDraft] = useState({ word: entry.word, note: entry.note, tags: entry.tags });
    const startEditing = () => {
        setDraft({ word: entry.word, note: entry.note, tags: entry.tags });
        setEditing(true);
    };
    const save = async () => {
        if (!draft.word.trim())
            return;
        await onUpdate(entry.id, { word: draft.word.trim(), note: draft.note.trim(), tags: draft.tags });
        setEditing(false);
    };
    return (_jsx("li", { className: "border-b border-slate-200 p-3 last:border-b-0 dark:border-slate-700", children: editing ? (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(TextField, { label: "Word", value: draft.word, onChange: (event) => setDraft({ ...draft, word: event.target.value }) }), _jsx(TextField, { label: "Note", value: draft.note, onChange: (event) => setDraft({ ...draft, note: event.target.value }) }), _jsx(TagInput, { label: "Tags", tags: draft.tags, onChange: (tags) => setDraft({ ...draft, tags }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", onClick: () => void save(), children: "Save" }), _jsx(Button, { size: "sm", variant: "secondary", onClick: () => setEditing(false), children: "Cancel" })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-semibold text-slate-900 dark:text-slate-100", children: entry.word }), entry.sentence && (_jsxs("p", { className: "line-clamp-2 text-xs italic text-slate-500 dark:text-slate-400", children: ["\u201C", entry.sentence, "\u201D"] })), entry.note && (_jsx("p", { className: "mt-1 text-xs text-slate-600 dark:text-slate-300", children: entry.note }))] }), _jsxs("div", { className: "flex shrink-0 items-center", children: [_jsx(IconButton, { label: entry.favorite ? `Unfavorite ${entry.word}` : `Favorite ${entry.word}`, active: entry.favorite, onClick: () => void onToggleFavorite(entry.id), children: entry.favorite ? '★' : '☆' }), _jsx(IconButton, { label: `Edit ${entry.word}`, onClick: startEditing, children: "\u270E" }), _jsx(IconButton, { label: `Delete ${entry.word}`, onClick: () => setConfirming(true), children: "\uD83D\uDDD1" })] })] }), entry.tags.length > 0 && (_jsx("ul", { className: "mt-1.5 flex flex-wrap gap-1", children: entry.tags.map((tag) => (_jsx("li", { className: "rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300", children: tag }, tag))) })), entry.explanation ? (_jsx(ExplanationView, { explanation: entry.explanation })) : explaining ? (_jsx("div", { className: "mt-2", children: _jsx(Spinner, { label: "Asking your AI\u2026" }) })) : null, _jsxs("div", { className: "mt-2 flex items-center gap-2", children: [_jsx(Button, { size: "sm", variant: "secondary", disabled: explaining, onClick: () => void onExplain(entry), children: entry.explanation ? 'Refresh explanation' : 'AI explain' }), entry.sourceUrl && (_jsx("a", { href: entry.sourceUrl, target: "_blank", rel: "noreferrer", className: "truncate text-xs text-brand-600 hover:underline dark:text-brand-400", children: "Source" }))] }), confirming && (_jsxs("div", { role: "alertdialog", "aria-label": `Delete ${entry.word}?`, className: "mt-2 rounded-md bg-red-50 p-2 dark:bg-red-950", children: [_jsxs("p", { className: "text-xs text-red-800 dark:text-red-200", children: ["Delete \u201C", entry.word, "\u201D permanently?"] }), _jsxs("div", { className: "mt-1.5 flex gap-2", children: [_jsx(Button, { size: "sm", variant: "danger", onClick: () => void onDelete(entry.id), children: "Delete" }), _jsx(Button, { size: "sm", variant: "secondary", onClick: () => setConfirming(false), children: "Cancel" })] })] }))] })) }));
}
