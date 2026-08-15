import type { VocabularyEntry, VocabularyPatch } from '@/shared/types/vocabulary';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { BookIcon } from '@/shared/ui/Icons';
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
  onQuickAdd?: (word: string) => void;
}

/**
 * Renders the vocabulary list inside the popup Library tab.
 *
 * Previously this used react-window `VariableSizeList` with a JS-measured
 * viewport height. That virtualization fought the flex layout: the measured
 * row heights drifted from the estimates, so the last rows fell outside the
 * scroll range and were clipped / unreachable (the "list scroll" bug).
 *
 * The popup Library is a small list, so we render every entry directly inside
 * a single `overflow-y-auto` flex child. One scroller, no measurement, no
 * clipping — the bottom items are always reachable.
 */
export function LibraryList(props: LibraryListProps): JSX.Element {
  const { entries, loading, filtered } = props;

  if (loading) {
    return <SkeletonList rows={4} />;
  }

  if (entries.length === 0) {
    return filtered ? (
      <EmptyState
        icon={<BookIcon size={20} />}
        title="No matches"
        description="Try a different search term or clear your filters."
      />
    ) : (
      <EmptyState
        icon={<BookIcon size={20} />}
        title="No words yet"
        description="Select text on any page and use the context menu, Ctrl+Shift+S, or the form above."
      />
    );
  }

  return (
    <ul className="avs-scroll flex-1 min-h-0 space-y-2 overflow-y-auto p-3">
      {entries.map((entry) => (
        <li key={entry.id} role="listitem">
          <EntryCard
            entry={entry}
            explaining={props.explainingId === entry.id}
            onUpdate={props.onUpdate}
            onDelete={props.onDelete}
            onToggleFavorite={props.onToggleFavorite}
            onExplain={props.onExplain}
            onQuickAdd={props.onQuickAdd}
          />
        </li>
      ))}
    </ul>
  );
}
