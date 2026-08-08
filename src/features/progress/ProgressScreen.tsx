import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BookIcon, CalendarDaysIcon, FlameIcon } from '@/shared/ui/Icons';
import { EmptyState } from '@/shared/ui/EmptyState';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { buildHistory, countInWindow } from '@/shared/lib/history';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

const DAYS = 14;

/** Progress view: a 14-day save-history bar chart plus summary stats. */
export function ProgressScreen() {
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [all, stats] = await Promise.all([
      vocabularyRepository.list({ sortBy: 'word', sortDirection: 'asc' }),
      vocabularyRepository.stats(),
    ]);
    setEntries(all);
    setTotal(stats.total);
    setStreak(stats.streak);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="p-4 text-sm text-slate-500">Loading progress…</p>;
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<BookIcon size={20} />}
        title="No progress yet"
        description="As you save words, this view charts how your vocabulary grows day by day."
      />
    );
  }

  const now = Date.now();
  const history = buildHistory(entries, DAYS, now);
  const last7 = countInWindow(entries, 7, now);
  const max = Math.max(1, ...history.map((h) => h.count));

  return (
    <div className="border-b border-slate-200 p-3 dark:border-slate-700">
      <div className="flex gap-2">
        <Stat icon={<BookIcon size={14} />} label="Total" value={total} />
        <Stat icon={<CalendarDaysIcon size={14} />} label="Last 7 days" value={last7} />
        <Stat icon={<FlameIcon size={14} />} label="Streak" value={streak} />
      </div>

      <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Words saved · last {DAYS} days</p>
      <svg viewBox={`0 0 280 64`} className="mt-1 w-full" role="img" aria-label="Words saved per day">
        {history.map((point, index) => {
          const x = (index / (history.length - 1)) * 268 + 6;
          const barHeight = (point.count / max) * 48;
          const y = 56 - barHeight;
          return (
            <rect
              key={point.date}
              x={x - 4}
              y={y}
              width={8}
              height={Math.max(2, barHeight)}
              rx={2}
              className="fill-brand-500"
            >
              <title>{`${point.date}: ${point.count} word${point.count === 1 ? '' : 's'}`}</title>
            </rect>
          );
        })}
        <line x1={6} y1={56} x2={274} y2={56} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={1} />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{history[0]?.date.slice(5)}</span>
        <span>{history[history.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg border border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-800">
      <span className="text-brand-600 dark:text-brand-300">{icon}</span>
      <span className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100">{value}</span>
      <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}
