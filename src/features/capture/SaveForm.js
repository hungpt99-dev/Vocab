import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { TagInput } from '@/shared/ui/TagInput';
import { TextField } from '@/shared/ui/TextField';
/** Save the current page selection, or a manually typed word. */
export function SaveForm({ selection, saving, onSave }) {
    const [word, setWord] = useState('');
    const [note, setNote] = useState('');
    const [tags, setTags] = useState([]);
    const [error, setError] = useState('');
    useEffect(() => {
        if (selection?.word)
            setWord(selection.word);
    }, [selection?.word]);
    const submit = async () => {
        if (!word.trim()) {
            setError('Type or select a word first.');
            return;
        }
        setError('');
        await onSave({ word: word.trim(), note: note.trim(), tags });
        setNote('');
        setTags([]);
    };
    return (_jsxs("form", { className: "flex flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-700", onSubmit: (event) => {
            event.preventDefault();
            void submit();
        }, children: [_jsx(TextField, { label: "Word or phrase", value: word, onChange: (event) => setWord(event.target.value), placeholder: "Select text on the page, or type it here", error: error, autoFocus: true }), selection?.sentence && (_jsxs("p", { className: "line-clamp-2 text-xs italic text-slate-500 dark:text-slate-400", children: ["\u201C", selection.sentence, "\u201D"] })), _jsx(TextField, { label: "Note", value: note, onChange: (event) => setNote(event.target.value), placeholder: "Optional reminder" }), _jsx(TagInput, { label: "Tags", tags: tags, onChange: setTags }), _jsx(Button, { type: "submit", disabled: saving, children: saving ? 'Saving…' : 'Save to vocabulary' })] }));
}
