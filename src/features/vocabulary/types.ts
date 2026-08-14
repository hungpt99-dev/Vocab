/**
 * Types for the Save-Word vocabulary normalization pipeline.
 *
 * The pipeline turns a raw, user-typed surface form into a canonical vocabulary
 * concept through four independent linguistic stages:
 *
 *   1. Normalization  (text-level cleanup, language-agnostic, no NLP)
 *   2. POS / linguistic analysis (delegated to an injected analyzer)
 *   3. Singularization (noun plural -> singular, when applicable)
 *   4. Lemmatization  (resolve the base dictionary form, POS-aware)
 *   5. Word-family resolution (group lexical variants under one identity)
 *
 * Stages 2–5 are produced by a pluggable `LinguisticAnalyzer`. In this project
 * that analyzer is AI-backed: when the user has an AI provider configured, the
 * model is prompted for the part of speech, singular, lemma and word family of
 * the word *in whatever language the user encountered it*. This keeps the logic
 * correct for every language the user studies — no English-only rules are baked
 * into the code. The pipeline framework itself stays language-agnostic and has
 * no hard-coded morphology.
 */

/** Grammatical part of speech. `unknown` means the analyzer could not decide. */
export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'other'
  | 'unknown';

/**
 * The raw result of linguistic analysis for one word, as returned by the
 * analyzer. Every field is a best-effort model output; `confident: false` tells
 * the pipeline not to make dangerous merges downstream.
 */
export interface LinguisticAnalysis {
  /** Canonical singular form (for nouns), or the word itself when not plural. */
  singular: string;
  /** Canonical lemma (base dictionary form). */
  lemma: string;
  /** Part of speech of the word in its original context. */
  partOfSpeech: PartOfSpeech;
  /** Stable word-family identity (the concept this word belongs to). */
  familyId: string;
  /** True when the analyzer is confident enough to rely on these values. */
  confident: boolean;
}

/**
 * The result of running a word through the full normalization pipeline.
 *
 * `surfaceForm` is exactly what the user encountered (e.g. `BOOKS`, `running`,
 * `beautifully`). It is preserved verbatim and never overwritten by a canonical
 * form — the UI uses it to show "you encountered: books".
 *
 * `normalizedForm` is the language-agnostic text-level (trim/lowercase/unicode)
 * form.
 *
 * `lemma` is the canonical linguistic form (`book`, `run`, `beautiful`).
 *
 * `familyId` is the vocabulary-concept identity. Two words that share a family
 * are the same vocabulary concept and must not be saved twice for one user.
 */
export interface NormalizedWord {
  /** What the user actually selected, trimmed but otherwise unaltered. */
  surfaceForm: string;
  /** Text-normalized form (lowercase, unicode-collapsed, trimmed). */
  normalizedForm: string;
  /** Canonical lemma from singularization + lemmatization. */
  lemma: string;
  /** Word-family identity derived from the analysis. */
  familyId: string;
  /** Best-effort part of speech decided during analysis. */
  partOfSpeech: PartOfSpeech;
  /** True when the family was derived from the lemma because the analyzer had
   *  no explicit family (fallback behaviour, deterministic). */
  familyFallback: boolean;
  /** Whether the linguistic analysis was confident. */
  confident: boolean;
}
