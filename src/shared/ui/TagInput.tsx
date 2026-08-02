import { useId, useState, type KeyboardEvent } from 'react';
import { normalizeTags } from '@/shared/lib/text';

export interface TagInputProps {
  label: string;
  tags: readonly string[];
  onChange: (tags: string[]) => void;
}

/** Chip-style tag editor: Enter or comma commits, Backspace removes the last tag. */
export function TagInput({ label, tags, onChange }: TagInputProps) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const commit = (value: string): void => {
    const next = normalizeTags([...tags, value]);
    if (next.length !== tags.length) onChange(next);
    setDraft('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (draft.trim()) commit(draft);
      return;
    }
    if (event.key === 'Backspace' && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-brand-100 px-1.5 py-0.5 text-xs text-brand-800 dark:bg-brand-900 dark:text-brand-100"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(tags.filter((value) => value !== tag))}
              className="rounded text-brand-600 hover:text-brand-900 dark:text-brand-300"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft.trim() && commit(draft)}
          placeholder="Add a tag…"
          className="h-6 min-w-[6rem] flex-1 bg-transparent px-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
        />
      </div>
    </div>
  );
}
