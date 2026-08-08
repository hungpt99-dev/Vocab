import { useCallback, useEffect, useState } from 'react';
import { RotateCwIcon, LayersIcon } from '@/shared/ui/Icons';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { reviewRepository, type DueCard } from '@/storage/review-repository';
import type { SrsGrade } from '@/shared/lib/srs';

const GRADES: { grade: SrsGrade; label: string; tone: string }[] = [
  { grade: 'again', label: 'Again', tone: 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300' },
  { grade: 'hard', label: 'Hard', tone: 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300' },
  { grade: 'good', label: 'Good', tone: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300' },
  { grade: 'easy', label: 'Easy', tone: 'border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300' },
];

/** Spaced-repetition review queue: flip a due card, grade recall, advance. */
export function ReviewScreen() {
  const [cards, setCards] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [graded, setGraded] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const due = await reviewRepository.dueCards(20);
    setCards(due);
    setIndex(0);
    setFlipped(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = cards[index];

  const grade = useCallback(
    async (g: SrsGrade) => {
      if (!current) return;
      await reviewRepository.recordGrade(current.id, g);
      setGraded((n) => n + 1);
      const nextIndex = index + 1;
      if (nextIndex >= cards.length) {
        setCards([]);
        setIndex(0);
      } else {
        setIndex(nextIndex);
        setFlipped(false);
      }
    },
    [current, index, cards.length],
  );

  if (loading) {
    return <p className="p-4 text-sm text-slate-500">Loading reviews…</p>;
  }

  if (!current) {
    return (
      <EmptyState
        icon={<LayersIcon size={20} />}
        title={graded > 0 ? 'All done for now' : 'Nothing to review'}
        description={
          graded > 0
            ? `You reviewed ${graded} card${graded === 1 ? '' : 's'}. Due cards will return as their intervals elapse.`
            : 'Saved words are scheduled automatically. Check back after a day or two.'
        }
      />
    );
  }

  return (
    <div className="border-b border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Review {index + 1} of {cards.length}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded p-1 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:hover:text-slate-200"
          aria-label="Restart review"
        >
          <RotateCwIcon size={14} aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-700"
      >
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{current.word}</p>
        {flipped ? (
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {current.entry?.explanation?.translation && (
              <p className="text-slate-500 dark:text-slate-400">{current.entry.explanation.translation}</p>
            )}
            <p className="mt-1">
              {current.entry?.explanation?.meaning ?? 'No explanation yet — enrich this word to see its meaning.'}
            </p>
            {current.entry?.sentence && (
              <p className="mt-1 italic text-slate-400">“{current.entry.sentence}”</p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-400">Tap to reveal</p>
        )}
      </button>

      {flipped && (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {GRADES.map(({ grade: g, label, tone }) => (
            <Button key={g} size="sm" variant="ghost" className={`border ${tone}`} onClick={() => void grade(g)}>
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
