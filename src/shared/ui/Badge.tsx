import type { ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  /** Optional leading icon (e.g. a Lucide icon node). */
  icon?: ReactNode;
  className?: string;
}

/** Small, consistent chip used for tags and metadata. */
export function Badge({ children, icon, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-100 ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
