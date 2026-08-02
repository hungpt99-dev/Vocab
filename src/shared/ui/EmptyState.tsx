import type { ReactNode } from 'react';

export function EmptyState({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}
