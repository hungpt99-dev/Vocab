import type { Settings, SavedProvider } from '@/shared/types/settings';
import type { LinguisticAnalysis } from './types';
import type { LinguisticAnalyzer } from './linguistic-analyzer';
import {
  LINGUISTIC_SYSTEM_PROMPT,
  linguisticUserPrompt,
  toPartOfSpeech,
} from './linguistic-analyzer';
import { extractJsonObject } from '@/ai/parse';
import { AiError } from '@/ai/types';
import { runAiCall, runWithFallback } from '@/ai/pipeline';

/**
 * AI-backed linguistic analyzer. Goes through the project's normal provider
 * transport (auth, rate limiting, retry, fallback) via `AiProvider.complete`,
 * so it inherits all of the resilience of the explain/translate paths.
 *
 * The model returns the singular, lemma, part of speech and word-family for the
 * word *in its own language*, which is exactly what makes this language-agnostic
 * — no English morphology is hard-coded here.
 *
 * `getSettings` lets the analyzer stay decoupled from the storage layer (tests
 * inject a stub). When no AI provider is configured the analyzer cannot run;
 * callers should check `isAvailable` before using it.
 */
export class AiLinguisticAnalyzer implements LinguisticAnalyzer {
  constructor(
    private readonly getSettings: () => Promise<Settings>,
  ) {}

  /** Whether an AI provider is currently configured and usable. */
  async isAvailable(): Promise<boolean> {
    const settings = await this.getSettings();
    const active = settings.providers.find((p) => p.id === settings.activeProviderId);
    if (!active) return false;
    const needsKey = !['ollama', 'lmstudio'].includes(active.type);
    return needsKey ? (active.apiKey ?? '').trim().length > 0 : true;
  }

  async analyze(word: string, context?: string): Promise<LinguisticAnalysis> {
    const settings = await this.getSettings();
    try {
      const { value } = await runWithFallback(settings, (provider, signal) =>
        this.runOnce(provider, word, context, signal),
      );
      return value;
    } catch (error) {
      // No AI provider configured, or the call failed for a config reason
      // (missing key / unknown provider). The pipeline is opt-in: when the user
      // has no AI, we still save the word, just without linguistic reduction
      // (the word is its own lemma/family). Never throw on save for this.
      if (error instanceof AiError && ['unknown_provider', 'missing_api_key', 'unauthorized'].includes(error.code)) {
        return {
          singular: word,
          lemma: word,
          partOfSpeech: 'unknown',
          familyId: word.toLowerCase(),
          confident: false,
        };
      }
      // Transient provider failures (network/timeout) also degrade gracefully so
      // saving a word never hard-fails just because the model is unreachable.
      if (error instanceof AiError) {
        return {
          singular: word,
          lemma: word,
          partOfSpeech: 'unknown',
          familyId: word.toLowerCase(),
          confident: false,
        };
      }
      throw error;
    }
  }

  private runOnce(
    provider: SavedProvider,
    word: string,
    context: string | undefined,
    signal?: AbortSignal,
  ): Promise<LinguisticAnalysis> {
    return runAiCall(
      provider,
      (adapter, config) =>
        adapter
          .complete(LINGUISTIC_SYSTEM_PROMPT, linguisticUserPrompt(word, context), config)
          .then((raw) => coerceAnalysis(raw, word)),
      signal,
    );
  }
}

/** Parse and validate the model's JSON into a LinguisticAnalysis. */
function coerceAnalysis(raw: string, fallbackWord: string): LinguisticAnalysis {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(raw) as Record<string, unknown>;
  } catch {
    // The model didn't return usable JSON — fall back to a deterministic,
    // non-destructive analysis (the word is its own lemma/family).
    return { singular: fallbackWord, lemma: fallbackWord, partOfSpeech: 'unknown', familyId: fallbackWord.toLowerCase(), confident: false };
  }

  const asString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const singular = asString(parsed.singular) || fallbackWord;
  const lemma = asString(parsed.lemma) || singular || fallbackWord;
  const familyId = asString(parsed.familyId) || lemma.toLowerCase();
  return {
    singular,
    lemma,
    partOfSpeech: toPartOfSpeech(parsed.partOfSpeech),
    familyId,
    confident: parsed.confident !== false,
  };
}

/**
 * Last-resort analyzer used when no AI provider is configured. It performs NO
 * linguistic reduction — the word is its own lemma and family. This guarantees
 * the save pipeline still works offline (and never fabricates cross-language
 * relationships), while the richer AI analyzer handles real normalization when
 * the user has a key.
 */
export class IdentityLinguisticAnalyzer implements LinguisticAnalyzer {
  async analyze(word: string): Promise<LinguisticAnalysis> {
    return {
      singular: word,
      lemma: word,
      partOfSpeech: 'unknown',
      familyId: word.toLowerCase(),
      confident: false,
    };
  }
}
