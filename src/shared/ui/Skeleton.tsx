/** Shimmering placeholder used while data loads, to avoid blank screens. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`}
    />
  );
}

/** A stack of skeleton rows for list loading states. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}
