/**
 * Multiple-choice quiz generator built from saved vocabulary.
 *
 * Pure and deterministic given the entries and a seed, so it is unit-testable
 * without storage. A question asks the learner to pick the correct
 * translation/meaning for a word; distractors come from other saved words so
 * the practice stays inside the user's own vocabulary.
 */
import type { VocabularyEntry } from '@/shared/types/vocabulary';

export interface QuizQuestion {
  word: string;
  prompt: string;
  options: string[];
  answerIndex: number;
}

/** Small deterministic PRNG (mulberry32) so quizzes are reproducible per seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function answerFor(entry: VocabularyEntry): string | null {
  const ex = entry.explanation;
  if (ex?.translation) return ex.translation;
  if (ex?.meaning) return ex.meaning;
  return null;
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export interface BuildQuizOptions {
  count?: number;
  seed?: number;
}

/**
 * Build up to `count` multiple-choice questions from saved entries.
 * Returns an empty array when there are fewer than 4 entries with a usable
 * explanation (need a correct answer plus 3 distractors).
 */
export function buildQuiz(entries: VocabularyEntry[], options: BuildQuizOptions = {}): QuizQuestion[] {
  const count = options.count ?? 10;
  const rand = rng(options.seed ?? 1);

  const usable = entries
    .map((entry) => ({ entry, answer: answerFor(entry) }))
    .filter((item): item is { entry: VocabularyEntry; answer: string } => Boolean(item.answer));

  if (usable.length < 4) return [];

  const pool = shuffle(usable, rand);
  const questions: QuizQuestion[] = [];

  for (const item of pool) {
    if (questions.length >= count) break;
    const distractors = shuffle(
      usable.filter((other) => other.entry.id !== item.entry.id && other.answer !== item.answer),
      rand,
    )
      .slice(0, 3)
      .map((d) => d.answer);

    if (distractors.length < 3) continue;

    const options = shuffle([item.answer, ...distractors], rand);
    questions.push({
      word: item.entry.word,
      prompt: `“${item.entry.word}” means…`,
      options,
      answerIndex: options.indexOf(item.answer),
    });
  }

  return questions;
}
