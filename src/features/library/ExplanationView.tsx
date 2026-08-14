import type { Explanation } from '@/shared/types/vocabulary';

function List({ label, items }: { label: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <ul className="list-inside list-disc text-xs text-slate-600 dark:text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Render a cached AI explanation. */
export function ExplanationView({ explanation }: { explanation: Explanation }) {
  return (
    <div className="mt-2 rounded-md bg-slate-50 p-2 dark:bg-slate-800">
      <p className="text-xs font-medium text-slate-800 dark:text-slate-100">{explanation.meaning}</p>
      {explanation.translation && (
        <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-300">
          {explanation.translation}
        </p>
      )}
      {explanation.simpleExplanation !== explanation.meaning && (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{explanation.simpleExplanation}</p>
      )}
      {explanation.pronunciation && (
        <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
          {explanation.pronunciation}
        </p>
      )}
      <List label="Examples" items={explanation.examples} />
      <List label="Synonyms" items={explanation.synonyms} />
      <List label="Collocations" items={explanation.collocations} />
      {explanation.etymology && (
        <div className="mt-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Etymology</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{explanation.etymology}</p>
        </div>
      )}
      {explanation.register && (
        <div className="mt-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Register</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{explanation.register}</p>
        </div>
      )}
      <List label="Related phrases" items={explanation.relatedPhrases ?? []} />
      <p className="mt-1.5 text-[10px] text-slate-400">
        {explanation.provider}
        {explanation.model ? ` · ${explanation.model}` : ''}
      </p>
    </div>
  );
}
