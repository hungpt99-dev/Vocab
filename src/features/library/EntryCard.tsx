import { useState } from 'react';
import type { VocabularyEntry, VocabularyPatch } from '@/shared/types/vocabulary';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Spinner } from '@/shared/ui/Spinner';
import { TagInput } from '@/shared/ui/TagInput';
import { TextField } from '@/shared/ui/TextField';
import { Badge } from '@/shared/ui/Badge';
import { PlusIcon } from '@/shared/ui/Icons';
import { Dialog } from '@/shared/ui/Dialog';
import { StarIcon, StarOutlineIcon, PencilIcon, TrashIcon, SparklesIcon, ChevronDownIcon, ChevronRightIcon } from '@/shared/ui/Icons';
import { ExplanationView } from './ExplanationView';

export interface EntryCardProps {
  entry: VocabularyEntry;
  explaining: boolean;
  onUpdate: (id: string, patch: VocabularyPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => Promise<void>;
  onExplain: (entry: VocabularyEntry) => Promise<void>;
  onQuickAdd?: (word: string) => void;
}

export function EntryCard({
  entry,
  explaining,
  onUpdate,
  onDelete,
  onToggleFavorite,
  onExplain,
  onQuickAdd,
}: EntryCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showEnrich, setShowEnrich] = useState(false);
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

  const confirmDelete = async (): Promise<void> => {
    setConfirming(false);
    await onDelete(entry.id);
  };

  return (
    <div className="border-b border-slate-200 p-3 last:border-b-0 dark:border-slate-700">
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
                <p className="mt-0.5 line-clamp-2 text-xs italic text-slate-500 dark:text-slate-400">
                  “{entry.sentence}”
                </p>
              )}
              {entry.note && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{entry.note}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <IconButton
                label={entry.favorite ? `Unfavorite ${entry.word}` : `Favorite ${entry.word}`}
                active={entry.favorite}
                onClick={() => void onToggleFavorite(entry.id)}
              >
                {entry.favorite ? <StarIcon size={16} /> : <StarOutlineIcon size={16} />}
              </IconButton>
              <IconButton label={`Edit ${entry.word}`} onClick={startEditing}>
                <PencilIcon size={16} />
              </IconButton>
              <IconButton label={`Delete ${entry.word}`} onClick={() => setConfirming(true)}>
                <TrashIcon size={16} />
              </IconButton>
            </div>
          </div>

          {entry.tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {entry.tags.map((tag) => (
                <li key={tag}>
                  <Badge>{tag}</Badge>
                </li>
              ))}
            </ul>
          )}

          {entry.explanation && (entry.explanation.relatedPhrases?.length || entry.explanation.relatedWords?.length) && (
            <RelatedChips
              phrases={entry.explanation.relatedPhrases ?? []}
              words={entry.explanation.relatedWords ?? []}
              onAdd={onQuickAdd}
            />
          )}

          {entry.explanation ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowEnrich((value) => !value)}
                aria-expanded={showEnrich}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {showEnrich ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                {showEnrich ? 'Hide enrich data' : 'Show enrich data'}
              </button>
              {showEnrich && <ExplanationView explanation={entry.explanation} />}
            </div>
          ) : explaining ? (
            <div className="mt-2">
              <Spinner label="Asking your AI…" />
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={explaining} onClick={() => void onExplain(entry)}>
              <SparklesIcon size={14} className="mr-1.5" aria-hidden="true" />
              {entry.explanation ? 'Refresh explanation' : 'AI explain'}
            </Button>
            {entry.sourceUrl && (
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 dark:text-brand-400"
              >
                Source
              </a>
            )}
          </div>

          <Dialog
            open={confirming}
            title={`Delete “${entry.word}”?`}
            onClose={() => setConfirming(false)}
            actions={[
              { label: 'Cancel', onClick: () => setConfirming(false) },
              { label: 'Delete', variant: 'danger', onClick: () => void confirmDelete() },
            ]}
          >
            This word will be removed from your local vocabulary. You can re-save it later.
          </Dialog>
        </>
      )}
    </div>
  );
}

/**
 * Tappable chips for AI-suggested related vocabulary, surfacing the words the
 * explanation already captured (relatedPhrases / relatedWords) as quick-save
 * targets. Turning already-stored AI data into vocabulary discovery — no extra
 * AI calls.
 */
function RelatedChips({
  phrases,
  words,
  onAdd,
}: {
  phrases: readonly string[];
  words: readonly string[];
  onAdd?: (word: string) => void;
}) {
  const items = [...phrases, ...words].filter((item) => item.trim().length > 0).slice(0, 8);
  if (items.length === 0 || !onAdd) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Related vocabulary</p>
      <ul className="flex flex-wrap gap-1">
        {items.map((item) => (
          <li key={item}>
            <button
              type="button"
              onClick={() => onAdd(item.trim())}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-brand-300"
            >
              <PlusIcon size={12} aria-hidden="true" />
              {item}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
