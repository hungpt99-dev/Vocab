import type { NormalizedWord } from './types';
import type { WordNormalizer } from './word-normalizer';
import type { LinguisticAnalyzer } from './linguistic-analyzer';
import { wordNormalizer } from './word-normalizer';
import { IdentityLinguisticAnalyzer } from './ai-linguistic-analyzer';

/**
 * Orchestrates the Save-Word pipeline into a single canonical result:
 *
 *   surfaceForm ──▶ Normalization (text) ──▶ Linguistic analysis
 *                  (POS / singular / lemma / family) ──▶ NormalizedWord
 *
 * The four linguistic concerns from the spec — normalization, singularization,
 * lemmatization and word-family resolution — are kept as separate *concepts* and
 * separate responsibilities, but the actual linguistic work is delegated to an
 * injected `LinguisticAnalyzer`. In this project that analyzer is AI-backed (it
 * prompts the user's configured model, which handles any language), so the
 * pipeline stays correct for every language without hard-coding morphology here.
 *
 * The orchestrator is the only place that knows the order of the stages; the
 * stages themselves stay decoupled and individually testable, and the analyzer
 * can be swapped without touching callers.
 */
export interface VocabularyNormalizationService {
  normalize(rawWord: string, context?: string): Promise<NormalizedWord>;
}

export interface NormalizationDeps {
  normalizer?: WordNormalizer;
  analyzer?: LinguisticAnalyzer;
}

export class DefaultVocabularyNormalizationService
  implements VocabularyNormalizationService
{
  private readonly normalizer: WordNormalizer;
  private readonly analyzer: LinguisticAnalyzer;

  constructor(deps: NormalizationDeps = {}) {
    this.normalizer = deps.normalizer ?? wordNormalizer;
    // Offline safe default: when no AI analyzer is injected the word is its own
    // lemma/family (non-destructive, language-agnostic fallback).
    this.analyzer = deps.analyzer ?? new IdentityLinguisticAnalyzer();
  }

  async normalize(rawWord: string, context?: string): Promise<NormalizedWord> {
    const surfaceForm = (typeof rawWord === 'string' ? rawWord : '').trim();

    // Stage 1 — language-agnostic text normalization (no linguistics).
    const normalizedForm = this.normalizer.normalize(surfaceForm);
    if (!normalizedForm) {
      return {
        surfaceForm,
        normalizedForm: '',
        lemma: '',
        familyId: '',
        partOfSpeech: 'unknown',
        familyFallback: false,
        confident: false,
      };
    }

    // Stages 2–5 — singularization, lemmatization, family resolution:
    // delegated to the (AI-backed) linguistic analyzer, in the word's language.
    const analysis = await this.analyzer.analyze(normalizedForm, context);

    const lemma = analysis.lemma || normalizedForm;
    const familyId = analysis.familyId || lemma.toLowerCase();

    return {
      surfaceForm,
      normalizedForm,
      lemma,
      familyId,
      partOfSpeech: analysis.partOfSpeech,
      // Deterministic fallback: when the analyzer had no explicit family
      // identity, the lemma becomes the family identity. We never invent a
      // broader family or merge unrelated words via fuzzy matching.
      familyFallback: !analysis.confident,
      confident: analysis.confident,
    };
  }
}

import { settingsRepository } from '@/storage/settings-repository';
import { AiLinguisticAnalyzer } from './ai-linguistic-analyzer';

/**
 * Default service: AI-backed linguistic analysis (enabled when the user has an
 * AI provider configured), falling back to a non-destructive identity analysis
 * when no key is present. Callers that need different wiring inject their own
 * analyzer via `NormalizationDeps`.
 */
export const vocabularyNormalizationService: VocabularyNormalizationService =
  new DefaultVocabularyNormalizationService({
    analyzer: new AiLinguisticAnalyzer(() => settingsRepository.get()),
  });
