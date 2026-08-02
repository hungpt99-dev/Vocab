import { Button } from '@/shared/ui/Button';

export interface LibraryFilters {
  search: string;
  favoritesOnly: boolean;
  tag: string;
}

export interface LibraryToolbarProps {
  filters: LibraryFilters;
  tags: readonly string[];
  count: number;
  onChange: (filters: LibraryFilters) => void;
}

export function LibraryToolbar({ filters, tags, count, onChange }: LibraryToolbarProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Search words, notes and tags"
          aria-label="Search vocabulary"
          className="h-8 flex-1 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <Button
          size="sm"
          variant={filters.favoritesOnly ? 'primary' : 'secondary'}
          aria-pressed={filters.favoritesOnly}
          onClick={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
        >
          ★ Favorites
        </Button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant={filters.tag ? 'ghost' : 'secondary'}
            aria-pressed={!filters.tag}
            onClick={() => onChange({ ...filters, tag: '' })}
          >
            All
          </Button>
          {tags.map((tag) => (
            <Button
              key={tag}
              size="sm"
              variant={filters.tag === tag ? 'primary' : 'ghost'}
              aria-pressed={filters.tag === tag}
              onClick={() => onChange({ ...filters, tag: filters.tag === tag ? '' : tag })}
            >
              {tag}
            </Button>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
        {count} {count === 1 ? 'word' : 'words'}
      </p>
    </div>
  );
}
