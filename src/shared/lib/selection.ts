import { detectLanguage, isPhrase } from './text';

/**
 * The unit of a text selection. Drives which explain prompt variant is used
 * (word vs phrase vs sentence vs paragraph).
 */
export type SelectionUnit = 'word' | 'phrase' | 'sentence' | 'paragraph';

/** Sentence/paragraph boundary: terminal punctuation followed by whitespace or end. */
const SENTENCE_END = /[.!?\u3002\uff01\uff1f]+(\s|$)/gu;

export interface SelectionInfo {
  /** Detected unit of the selection. */
  unit: SelectionUnit;
  /** Detected source language (best-effort, from script coverage). */
  language: string;
}

/**
 * Classify a selection's text into a unit and detect its source language.
 * Reuses the shared `isPhrase` and `detectLanguage` heuristics so the rules
 * live in exactly one place: a single token is a word, a multi-word span
 * without a sentence end is a phrase, one sentence is a sentence, and two or
 * more sentences form a paragraph.
 */
export function detectSelection(text: string): SelectionInfo {
  const collapsed = text.trim();
  let unit: SelectionUnit = 'word';
  if (collapsed && isPhrase(collapsed)) {
    const sentenceCount = (collapsed.match(SENTENCE_END) ?? []).length;
    unit = sentenceCount >= 2 ? 'paragraph' : sentenceCount === 1 ? 'sentence' : 'phrase';
  }
  return { unit, language: detectLanguage(collapsed) };
}
