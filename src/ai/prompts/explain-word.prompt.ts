import type { ExplainRequest } from '../types';
import type { SelectionUnit } from '@/shared/lib/selection';

/**
 * System instruction for the "explain a word" capability. Kept separate from
 * any provider adapter so the prompt strategy can evolve without touching the
 * transport code.
 */
export const EXPLAIN_WORD_SYSTEM_PROMPT = [
  'You are a concise bilingual lexicographer helping a language learner.',
  'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
  'The JSON must match this shape exactly:',
  '{"meaning":string,"simpleExplanation":string,"translation":string,"examples":string[],',
  '"synonyms":string[],"antonyms":string[],"relatedWords":string[],"pronunciation":string,',
  '"collocations":string[],"grammar":string}',
  'Rules: meaning is one precise sentence; simpleExplanation uses A2-level vocabulary;',
  'translation is the word translated into the requested language; examples has 2-3 natural',
  'sentences using the word; synonyms has up to 5 entries; antonyms has up to 5 opposites;',
  'relatedWords has up to 5 related terms (hypernyms, hyponyms, variants);',
  'pronunciation is IPA including slashes; collocations has up to 5 common word partners;',
  'grammar briefly notes part of speech, countability and irregular forms.',
].join(' ');

/** Task instruction for the detected selection unit, chosen by `unit`. */
const UNIT_INSTRUCTIONS: Record<SelectionUnit, string> = {
  word: 'Explain this word, its meaning and how it is used.',
  phrase: 'Explain this phrase or idiom and how it is used.',
  sentence: 'Explain the meaning and grammar of this sentence.',
  paragraph: 'Summarise and explain this paragraph, highlighting its key vocabulary.',
};

/** Build the user turn for a word-explanation request, per selection unit. */
export function buildExplainWordUserPrompt({
  word,
  context,
  language = 'English',
  unit = 'word',
  sourceLanguage,
}: ExplainRequest): string {
  const lines = [`Word or phrase: "${word}"`];
  if (context) lines.push(`It appeared in this sentence: "${context}"`);
  lines.push(UNIT_INSTRUCTIONS[unit]);
  if (sourceLanguage && sourceLanguage !== language) {
    lines.push(`The selected text is in ${sourceLanguage}.`);
  }
  lines.push(`Explain it in ${language}. Respond with JSON only.`);
  return lines.join('\n');
}
