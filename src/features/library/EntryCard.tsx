import { useState } from 'react';
import type { VocabularyEntry, VocabularyPatch } from '@/shared/types/vocabulary';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Spinner } from '@/shared/ui/Spinner';
import { TagInput } from '@/shared/ui/TagInput';
import { TextField } from '@/shared/ui/TextField';
import { ExplanationView } from './ExplanationView';

export interface EntryCardProps {
  entry: VocabularyEntry;
  explaining: boolean;
  onUpdate: (id: string, patch: VocabularyPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => Promise<void>;
  onExplain: (entry: VocabularyEntry) => Promise<void>;
}

export function EntryCard({
  entry,
  explaining,
  onUpdate,
  onDelete,
  onToggleFavorite,
  onExplain,
}: EntryCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState({ word: entry.word, note: entry.note, tags: entry.tags });

  const startEditing = (): void => {
    setDraft({ word: entry.word, note: entry.note, tags: entry.tags });
    setEditing(true);
  };

  const save = async (): Promise<void> => {
    if (!draft.word.trim()) return;
    await onUpdate(entry.id, { word: draft.word.trim(), note: draft.note.trim(), tags: draft.tags });
    setEditing(false);
  };

  return (
    <li className="border-b border-slate-200 p-3 last:border-b-0 dark:border-slate-700">
      {editing ? (
        <div className="flex flex-col gap-2">
          <TextField
            label="Word"
            value={draft.word}
            onChange={(event) => setDraft({ ...draft, word: event.target.value })}
          />
          <TextField
            label="Note"
            value={draft.note}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          />
          <TagInput label="Tags" tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void save()}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {entry.word}
              </p>
              {entry.sentence && (
                <p className="line-clamp-2 text-xs italic text-slate-500 dark:text-slate-400">
                  “{entry.sentence}”
                </p>
              )}
              {entry.note && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{entry.note}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center">
              <IconButton
                label={entry.favorite ? `Unfavorite ${entry.word}` : `Favorite ${entry.word}`}
                active={entry.favorite}
                onClick={() => void onToggleFavorite(entry.id)}
              >
                {entry.favorite ? '★' : '☆'}
              </IconButton>
              <IconButton label={`Edit ${entry.word}`} onClick={startEditing}>
                ✎
              </IconButton>
              <IconButton label={`Delete ${entry.word}`} onClick={() => setConfirming(true)}>
                🗑
              </IconButton>
            </div>
          </div>

          {entry.tags.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {entry.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}

          {entry.explanation ? (
            <ExplanationView explanation={entry.explanation} />
          ) : explaining ? (
            <div className="mt-2">
              <Spinner label="Asking your AI…" />
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={explaining} onClick={() => void onExplain(entry)}>
              {entry.explanation ? 'Refresh explanation' : 'AI explain'}
            </Button>
            {entry.sourceUrl && (
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs text-brand-600 hover:underline dark:text-brand-400"
              >
                Source
              </a>
            )}
          </div>

          {confirming && (
            <div role="alertdialog" aria-label={`Delete ${entry.word}?`} className="mt-2 rounded-md bg-red-50 p-2 dark:bg-red-950">
              <p className="text-xs text-red-800 dark:text-red-200">Delete “{entry.word}” permanently?</p>
              <div className="mt-1.5 flex gap-2">
                <Button size="sm" variant="danger" onClick={() => void onDelete(entry.id)}>
                  Delete
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </li>
  );
}
