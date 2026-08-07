import { useEffect, useState } from 'react';
import type { SelectionPayload } from '@/shared/messaging/contract';
import { Button } from '@/shared/ui/Button';
import { TagInput } from '@/shared/ui/TagInput';
import { TextField } from '@/shared/ui/TextField';
import { useSettings } from '@/shared/hooks/useSettings';

export interface SaveFormProps {
  selection: SelectionPayload | null;
  saving: boolean;
  word: string;
  onWordChange: (word: string) => void;
  onSave: (input: { word: string; note: string; tags: string[] }) => Promise<void>;
}

/** Save the current page selection, or a manually typed word. */
export function SaveForm({ selection, saving, word, onWordChange, onSave }: SaveFormProps) {
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState('');
  const { settings } = useSettings();

  useEffect(() => {
    if (selection?.word) onWordChange(selection.word);
  }, [selection?.word, onWordChange]);

  const submit = async (): Promise<void> => {
    if (!word.trim()) {
      setError('Type or select a word first.');
      return;
    }
    setError('');
    await onSave({ word: word.trim(), note: note.trim(), tags });
    setNote('');
    setTags([]);
  };

  return (
    <form
      className="flex flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-700"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <TextField
        label="Word or phrase"
        value={word}
        onChange={(event) => onWordChange(event.target.value)}
        placeholder="Select text on the page, or type it here"
        error={error}
        autoFocus
      />
      {selection?.sentence && (
        <p className="line-clamp-2 text-xs italic text-slate-500 dark:text-slate-400">
          “{selection.sentence}”
        </p>
      )}
      {selection?.word && (
        <div className="flex items-center gap-2">
          <mark
            className="rounded px-1 py-0.5 text-sm font-medium text-slate-900 dark:text-slate-900"
            style={{ backgroundColor: settings.highlightColor }}
          >
            {selection.word}
          </mark>
          <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
              style={{ backgroundColor: settings.highlightColor }}
            />
            Highlighted on the page
          </span>
        </div>
      )}
      <TextField
        label="Note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional reminder"
      />
      <TagInput label="Tags" tags={tags} onChange={setTags} />
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save to vocabulary'}
      </Button>
    </form>
  );
}
