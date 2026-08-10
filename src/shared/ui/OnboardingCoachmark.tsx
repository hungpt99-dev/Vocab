import { useState } from 'react';
import { SparklesIcon, CheckIcon, XIcon, ArrowRightIcon } from './Icons';
import { Button } from './Button';
import { markOnboarded } from '@/shared/lib/onboarding';

const STEPS = [
  {
    title: 'Select any word on a page',
    body: 'Highlight text on the web, then open this popup to save it or get an AI explanation.',
  },
  {
    title: 'Save it or Explain it',
    body: 'Save words to build your vocabulary, or use AI explain to learn meaning, examples, and usage.',
  },
];

/** One-time first-run coachmark shown when the library is empty. */
export function OnboardingCoachmark({ onStartSaving }: { onStartSaving?: () => void }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  if (done) return null;
  const current = STEPS[step];
  if (!current) return null;

  const finish = (): void => {
    void markOnboarded();
    setDone(true);
  };

  const isLast = step >= STEPS.length - 1;

  return (
    <div
      role="status"
      aria-label="Getting started"
      className="m-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-brand-700 dark:text-brand-300">
          <SparklesIcon size={16} aria-hidden="true" />
          <p className="text-xs font-semibold">Getting started</p>
        </div>
        <button
          type="button"
          onClick={finish}
          aria-label="Dismiss getting started"
          className="rounded p-0.5 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:hover:text-slate-200"
        >
          <XIcon size={14} aria-hidden="true" />
        </button>
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{current.title}</p>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{current.body}</p>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1" aria-hidden="true">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-1.5 rounded-full ${
                index === step ? 'bg-brand-500' : 'bg-brand-200 dark:bg-brand-800'
              }`}
            />
          ))}
        </div>
        {!isLast ? (
          <Button size="sm" variant="secondary" onClick={() => setStep((s) => s + 1)}>
            Next
            <ArrowRightIcon size={14} className="ml-1.5" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              finish();
              onStartSaving?.();
            }}
          >
            <CheckIcon size={14} className="mr-1.5" aria-hidden="true" />
            Save your first word
          </Button>
        )}
      </div>
    </div>
  );
}
