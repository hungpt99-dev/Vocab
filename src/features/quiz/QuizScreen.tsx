import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckIcon, XIcon, HelpCircleIcon } from '@/shared/ui/Icons';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { buildQuiz, type QuizQuestion } from '@/shared/lib/quiz';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

/** Self-quiz over the user's saved vocabulary: pick the right meaning. */
export function QuizScreen() {
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const all = await vocabularyRepository.list({ sortBy: 'word', sortDirection: 'asc' });
    setEntries(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const questionsForEntries = useMemo(() => buildQuiz(entries, { count: 10 }), [entries]);

  const start = (): void => {
    setQuestions(questionsForEntries);
    setIndex(0);
    setChosen(null);
    setScore(0);
    setStarted(true);
  };

  const restart = (): void => {
    setStarted(false);
    setChosen(null);
  };

  if (loading) {
    return <p className="p-4 text-sm text-slate-500">Loading quiz…</p>;
  }

  if (questionsForEntries.length === 0) {
    return (
      <EmptyState
        icon={<HelpCircleIcon size={20} />}
        title="Not enough words yet"
        description="Save and enrich at least 4 words (with meanings) to generate a practice quiz from your own vocabulary."
      />
    );
  }

  if (!started) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Test yourself on {questionsForEntries.length} word{questionsForEntries.length === 1 ? '' : 's'} drawn from
          your saved vocabulary.
        </p>
        <Button className="mt-3" onClick={start}>
          Start quiz
        </Button>
      </div>
    );
  }

  const current = questions[index];
  if (!current) {
    const total = questions.length;
    return (
      <div className="p-4">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quiz complete</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          You scored {score} / {total}.
        </p>
        <Button className="mt-3" onClick={restart}>
          Practice again
        </Button>
      </div>
    );
  }

  const answered = chosen !== null;
  const isCorrect = answered && chosen === current.answerIndex;

  const choose = (optionIndex: number): void => {
    if (answered) return;
    setChosen(optionIndex);
    if (optionIndex === current.answerIndex) setScore((s) => s + 1);
  };

  const next = (): void => {
    setChosen(null);
    setIndex((i) => i + 1);
  };

  return (
    <div className="border-b border-slate-200 p-3 dark:border-slate-700">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        Question {index + 1} of {questions.length}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{current.prompt}</p>

      <div className="mt-3 flex flex-col gap-1.5">
        {current.options.map((option, optionIndex) => {
          const selected = chosen === optionIndex;
          const correct = optionIndex === current.answerIndex;
          const tone = !answered
            ? 'border-slate-200 hover:border-brand-300 dark:border-slate-700'
            : correct
              ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
              : selected
                ? 'border-red-400 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
                : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400';
          return (
            <button
              key={option}
              type="button"
              disabled={answered}
              onClick={() => choose(optionIndex)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${tone}`}
            >
              <span>{option}</span>
              {answered && correct && <CheckIcon size={14} aria-hidden="true" />}
              {answered && selected && !correct && <XIcon size={14} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-3 flex items-center justify-between">
          <span className={`text-xs font-medium ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
            {isCorrect ? 'Correct' : `Answer: ${current.options[current.answerIndex]}`}
          </span>
          <Button size="sm" onClick={next}>
            {index + 1 >= questions.length ? 'Finish' : 'Next'}
          </Button>
        </div>
      )}
    </div>
  );
}
