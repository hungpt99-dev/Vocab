import type { LinguisticAnalysis, PartOfSpeech } from './types';

/**
 * Produces the linguistic analysis for a word: singular form, lemma, part of
 * speech and word-family identity.
 *
 * This is the ONLY linguistic stage. It is intentionally a pluggable interface:
 * the concrete implementation in this project asks the user's configured AI
 * provider, which can analyze the word in *whatever language the user
 * encountered it*. That keeps the behaviour correct across every language the
 * user studies without baking English-only morphology into the codebase.
 *
 * A future, fully offline implementation could implement the same interface with
 * a local dictionary model; the rest of the pipeline would not change.
 */
export interface LinguisticAnalyzer {
  analyze(word: string, context?: string): Promise<LinguisticAnalysis>;
}

const PARTS_OF_SPEECH: ReadonlySet<string> = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'other',
  'unknown',
]);

/** Coerce an arbitrary model string into a known PartOfSpeech. */
export function toPartOfSpeech(value: unknown): PartOfSpeech {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return PARTS_OF_SPEECH.has(v) ? (v as PartOfSpeech) : 'unknown';
}

/** System prompt: instruct the model to return strict, language-aware JSON. */
export const LINGUISTIC_SYSTEM_PROMPT = [
  'You are a precise multilingual linguistic analyzer for a vocabulary app.',
  'Given a word and the sentence it appeared in, return ONLY a JSON object with:',
  '- "singular": the singular form if the word is a plural noun, else the word itself (in the word\'s own language);',
  '- "lemma": the canonical base/dictionary form of the word (its lemma), in the word\'s own language;',
  '- "partOfSpeech": one of noun|verb|adjective|adverb|other|unknown;',
  '- "familyId": a stable identifier for the word\'s vocabulary *concept/family* — words that are the same concept (e.g. a word with its inflections and transparently-related derivations) share the same familyId; unrelated words must get DIFFERENT familyIds;',
  '- "confident": true unless you cannot determine the values reliably.',
  'Use the language of the input word. Do not translate. Do not invent families.',
  'Respond with a single JSON object and nothing else.',
].join(' ');

/** Build the user prompt for a given word + optional context. */
export function linguisticUserPrompt(word: string, context?: string): string {
  const sentence = context && context.trim() ? context.trim() : '(no context provided)';
  return `Word: ${word}\nSentence: ${sentence}`;
}
