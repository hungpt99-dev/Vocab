import { describe, expect, it } from 'vitest';
import { nextSchedule, SRS_DEFAULTS, type ReviewState } from './srs';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe('nextSchedule (SM-2)', () => {
  it('starts a fresh card at 2 days on first Good', () => {
    const next = nextSchedule(SRS_DEFAULTS, 'good', NOW);
    expect(next.reps).toBe(1);
    expect(next.intervalDays).toBe(2);
    expect(next.dueAt).toBe(NOW + 2 * DAY);
    expect(next.ease).toBeCloseTo(2.5, 2);
  });

  it('grows the interval by the ease factor after several reviews', () => {
    let state: ReviewState = SRS_DEFAULTS;
    let due = NOW;
    for (const grade of ['good', 'good', 'easy'] as const) {
      const next = nextSchedule(state, grade, due);
      state = { ease: next.ease, intervalDays: next.intervalDays, reps: next.reps };
      due = next.dueAt;
    }
    // 2 -> 6 (good, reps=2) -> ~6*3.2*1.3 ≈ 25
    expect(state.reps).toBe(3);
    expect(state.intervalDays).toBeGreaterThan(6);
  });

  it('resets interval and reps on Again (re-learning)', () => {
    const next = nextSchedule({ ease: 2.8, intervalDays: 30, reps: 5 }, 'again', NOW);
    expect(next.reps).toBe(0);
    expect(next.intervalDays).toBe(0);
    expect(next.dueAt).toBeGreaterThan(NOW);
    expect(next.dueAt).toBeLessThan(NOW + DAY);
  });

  it('never lets ease drop below 1.3', () => {
    const next = nextSchedule({ ease: 1.3, intervalDays: 1, reps: 1 }, 'again', NOW);
    expect(next.ease).toBeGreaterThanOrEqual(1.3);
  });
});
