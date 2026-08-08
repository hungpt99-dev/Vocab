/**
 * Spaced-repetition scheduling (SM-2, simplified) used by the review queue.
 *
 * Pure functions only — no storage, no clock beyond the `now` argument — so the
 * math is unit-testable in isolation. The repository supplies `now` and persists
 * the resulting schedule.
 */

export interface ReviewSchedule {
  /** Quality-of-recall grade the learner gave. */
  ease: number;
  /** Days until the card is next due. */
  intervalDays: number;
  /** Epoch ms when the card becomes due again. */
  dueAt: number;
  /** Number of successful reviews (resets to 0 on a lapse). */
  reps: number;
}

export type SrsGrade = 'again' | 'hard' | 'good' | 'easy';

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

const GRADE_FACTOR: Record<SrsGrade, number> = {
  again: 0,
  hard: 1.2,
  good: 2.5,
  easy: 3.2,
};

export interface ReviewState {
  ease: number;
  intervalDays: number;
  reps: number;
}

/**
 * Compute the next schedule for a card given its current state and the grade.
 * `again` resets the interval (re-learning); `hard`/`good`/`easy` grow it by the
 * ease factor. New cards (reps 0) start at 1 day on the first `good`.
 */
export function nextSchedule(state: ReviewState, grade: SrsGrade, now: number): ReviewSchedule {
  const factor = GRADE_FACTOR[grade];
  const ease = clampEase(state.ease + (factor - 2.5) * 0.1);

  if (grade === 'again') {
    return {
      ease,
      intervalDays: 0,
      dueAt: now + 10 * 60 * 1000, // 10 minutes — short re-learning gap
      reps: 0,
    };
  }

  let intervalDays: number;
  if (state.reps === 0) {
    intervalDays = grade === 'hard' ? 1 : grade === 'easy' ? 4 : 2;
  } else if (state.reps === 1) {
    intervalDays = grade === 'hard' ? 3 : grade === 'easy' ? 7 : 6;
  } else {
    intervalDays = Math.round(state.intervalDays * factor);
    if (grade === 'hard') intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
    if (grade === 'easy') intervalDays = Math.round(intervalDays * 1.3);
  }

  return {
    ease,
    intervalDays,
    dueAt: now + intervalDays * 24 * 60 * 60 * 1000,
    reps: state.reps + 1,
  };
}

function clampEase(value: number): number {
  return Math.max(MIN_EASE, Math.round(value * 100) / 100);
}

export const SRS_DEFAULTS: ReviewState = {
  ease: DEFAULT_EASE,
  intervalDays: 0,
  reps: 0,
};
