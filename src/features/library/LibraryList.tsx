import { useCallback, useRef } from 'react';
import { VariableSizeList, type ListChildComponentProps } from 'react-window';
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

const VIEWPORT_HEIGHT = 320; // matches the `max-h-80` scroll area
const MIN_ROW_HEIGHT = 96;
const OVERSCAN = 4;

interface RowData {
  entries: readonly VocabularyEntry[];
  list: LibraryListProps;
}

/**
 * Renders the vocabulary. For large libraries the list is virtualized so only
 * visible cards occupy the DOM. Loading and empty states skip the windowing
 * overhead entirely.
 *
 * Rows are variable-height (a card grows when expanded, edited, or showing an
 * explanation). Each rendered row reports its measured height via a ResizeObserver;
 * when it changes we tell the list to recompute offsets from that index so scroll
 * positions stay correct.
 */
export function LibraryList(props: LibraryListProps): JSX.Element {
  const { entries, loading, filtered } = props;
  const listRef = useRef<VariableSizeList<RowData>>(null);
  const sizeMap = useRef<Map<number, number>>(new Map());
  // Track ResizeObservers per row node so they can be disconnected on unmount.
  const rowObservers = useRef(new WeakMap<HTMLElement, ResizeObserver>());

  const itemSize = useCallback(
    (index: number): number => sizeMap.current.get(index) ?? MIN_ROW_HEIGHT,
    [],
  );

  const measure = useCallback(
    (node: HTMLElement | null, index: number): void => {
      if (!node) return;
      const observer = new ResizeObserver(() => {
        const height = node.getBoundingClientRect().height;
        if (sizeMap.current.get(index) !== height) {
          sizeMap.current.set(index, height);
          listRef.current?.resetAfterIndex(index);
        }
      });
      rowObservers.current.set(node, observer);
      observer.observe(node);
    },
    [],
  );

  // Disconnect observers for rows react-window unmounts.
  const cleanupRow = useCallback((node: HTMLElement | null): void => {
    if (!node) return;
    rowObservers.current.get(node)?.disconnect();
    rowObservers.current.delete(node);
  }, []);

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

  const rowData: RowData = { entries, list: props };

  const renderRow = (p: ListChildComponentProps<RowData>): JSX.Element => {
    const { index, style, data } = p;
    const entry = data.entries[index];
    if (!entry) return <></>;
    return (
      <li role="listitem" style={style} ref={(node) => { measure(node, index); cleanupRow(node); }}>
        <EntryCard
          entry={entry}
          explaining={data.list.explainingId === entry.id}
          onUpdate={data.list.onUpdate}
          onDelete={data.list.onDelete}
          onToggleFavorite={data.list.onToggleFavorite}
          onExplain={data.list.onExplain}
        />
      </li>
    );
  };

  return (
    <div className="avs-scroll max-h-80 overflow-y-auto">
      <VariableSizeList<RowData>
        ref={listRef}
        height={VIEWPORT_HEIGHT}
        width="100%"
        itemCount={entries.length}
        itemSize={itemSize}
        estimatedItemSize={MIN_ROW_HEIGHT}
        overscanCount={OVERSCAN}
        itemData={rowData}
        itemKey={(index, data) => data.entries[index]?.id ?? index}
      >
        {renderRow}
      </VariableSizeList>
    </div>
  );
}
