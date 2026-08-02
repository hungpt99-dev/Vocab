import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** A non-emoji icon node, e.g. a Lucide icon. */
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  /** Optional call-to-action, e.g. a Button. */
  action?: ReactNode;
}

/** Consistent empty state: icon, explanation, and a suggested action. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {icon && (
        <div
          aria-hidden="true"
          className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
        >
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="max-w-[16rem] text-xs text-slate-500 dark:text-slate-400">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
