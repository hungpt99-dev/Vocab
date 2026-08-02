import type { VocabularyEntry, VocabularyPatch } from '@/shared/types/vocabulary';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Spinner } from '@/shared/ui/Spinner';
import { EntryCard } from './EntryCard';

export interface LibraryListProps {
  entries: readonly VocabularyEntry[];
  loading: boolean;
  explainingId: string | null;
  filtered: boolean;
  onUpdate: (id: string, patch: VocabularyPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => Promise<void>;
  onExplain: (entry: VocabularyEntry) => Promise<void>;
}

export function LibraryList({
  entries,
  loading,
  explainingId,
  filtered,
  onUpdate,
  onDelete,
  onToggleFavorite,
  onExplain,
}: LibraryListProps) {
  if (loading) {
    return (
      <div className="p-4">
        <Spinner label="Loading your vocabulary…" />
      </div>
    );
  }

  if (entries.length === 0) {
    return filtered ? (
      <EmptyState title="No matches" description="Try a different search term or clear your filters." />
    ) : (
      <EmptyState
        title="No words yet"
        description="Select text on any page and use the context menu, Ctrl+Shift+S, or the form above."
      />
    );
  }

  return (
    <ul className="avs-scroll max-h-80 overflow-y-auto">
      {entries.map((entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          explaining={explainingId === entry.id}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onExplain={onExplain}
        />
      ))}
    </ul>
  );
}
