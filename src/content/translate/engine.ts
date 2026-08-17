import { collectTranslationUnits, type TranslationUnit } from './dom';
import { mapWithConcurrency } from '@/shared/lib/concurrency';

export interface TranslateEngineDeps {
  /** Translate one unit's source text. Injected so the engine stays provider-agnostic. */
  translate: (source: string) => Promise<string>;
  /** Return true to stop translating between units. */
  isCancelled?: () => boolean;
  /** How many units are translated in parallel; the background rate-limits the calls. */
  concurrency?: number;
}

export interface TranslateResult {
  translated: number;
  skipped: number;
  /** Message of the first failed unit, if any. */
  error?: string;
}

/** Collect and translate every unit below `root`, applying results in place. */
export async function translatePage(
  root: ParentNode,
  deps: TranslateEngineDeps,
): Promise<TranslateResult> {
  return translateUnits(collectTranslationUnits(root), deps);
}

/** Translate a pre-collected set of units. Exported for focused tests. */
export async function translateUnits(
  units: readonly TranslationUnit[],
  deps: TranslateEngineDeps,
): Promise<TranslateResult> {
  const concurrency = Math.max(1, deps.concurrency ?? 2);
  let translated = 0;
  let skipped = 0;
  let error: string | undefined;

  await mapWithConcurrency(units, concurrency, async (unit) => {
    if (deps.isCancelled?.()) return;
    const result = await deps.translate(unit.source).catch((caught: unknown) => {
      // A single failing unit must not abort the whole page; surface its message
      // and move on so the rest of the page still gets translated.
      const message = caught instanceof Error ? caught.message : 'Translation failed.';
      error ??= message;
      return null;
    });
    if (result === null || deps.isCancelled?.()) {
      skipped += 1;
      return;
    }
    if (unit.apply(result)) translated += 1;
    else skipped += 1;
  });

  return { translated, skipped, ...(error ? { error } : {}) };
}
