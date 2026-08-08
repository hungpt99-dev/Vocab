import { BookIcon, CalendarDaysIcon, FlameIcon } from './Icons';

export interface StatsRowProps {
  total: number;
  addedToday: number;
  streak: number;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${value}`}>
      <span className="text-brand-600 dark:text-brand-400" aria-hidden="true">
        {icon}
      </span>
      <span className="tabular-nums text-xs font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Compact progress strip shown under the popup app bar. */
export function StatsRow({ total, addedToday, streak }: StatsRowProps) {
  return (
    <div
      className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900"
      aria-label="Your vocabulary progress"
    >
      <Stat icon={<BookIcon size={14} />} value={total} label="total words saved" />
      <Stat icon={<CalendarDaysIcon size={14} />} value={addedToday} label="words added today" />
      <Stat icon={<FlameIcon size={14} />} value={streak} label="day streak" />
    </div>
  );
}
