import { BookIcon, CalendarDaysIcon, FlameIcon } from './Icons';

export interface StatsRowProps {
  total: number;
  addedToday: number;
  streak: number;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 py-2.5">
      <span className="text-brand-600 dark:text-brand-400" aria-hidden="true">
        {icon}
      </span>
      <span className="tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </span>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="h-5 w-px shrink-0 self-center bg-slate-200 dark:bg-slate-700" aria-hidden="true" />;
}

/** Compact progress strip shown under the popup app bar. */
export function StatsRow({ total, addedToday, streak }: StatsRowProps) {
  return (
    <div
      className="flex items-center border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      aria-label="Your vocabulary progress"
    >
      <Stat icon={<BookIcon size={15} />} value={total} label="Words" />
      <Divider />
      <Stat icon={<CalendarDaysIcon size={15} />} value={addedToday} label="Today" />
      <Divider />
      <Stat icon={<FlameIcon size={15} />} value={streak} label="Streak" />
    </div>
  );
}