/**
 * Build a per-day history of words saved, for progress charts.
 * Pure and date-stable given a fixed `now`, so it is unit-testable.
 */
import type { VocabularyEntry } from '@/shared/types/vocabulary';

export interface HistoryPoint {
  /** ISO date key, e.g. "2026-08-07". */
  date: string;
  count: number;
}

const DAY = 24 * 60 * 60 * 1000;

function dateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Return one point per day for the last `days` days (oldest first), counting
 * how many entries were created on each day. Days with no saves show count 0 so
 * the chart has a continuous axis.
 */
export function buildHistory(entries: VocabularyEntry[], days = 14, now: number = Date.now()): HistoryPoint[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = dateKey(entry.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points: HistoryPoint[] = [];
  const todayKey = dateKey(now);
  for (let i = days - 1; i >= 0; i -= 1) {
    const ts = now - i * DAY;
    const key = dateKey(ts);
    points.push({ date: key, count: counts.get(key) ?? (key > todayKey ? 0 : 0) });
  }
  return points;
}

/** Total words saved in the most recent `windowDays` days (inclusive of today). */
export function countInWindow(entries: VocabularyEntry[], windowDays: number, now: number = Date.now()): number {
  const cutoff = now - (windowDays - 1) * DAY;
  return entries.filter((e) => e.createdAt >= cutoff).length;
}
