import type { TranslateRequest } from '../types';

/**
 * System instruction for the "translate an article" capability. Kept separate
 * from any provider adapter so the prompt strategy can evolve without touching
 * the transport code.
 */
export const TRANSLATE_SYSTEM_PROMPT = [
  'You are a professional translator producing a bilingual reading edition of an article.',
  'Translate each paragraph faithfully and completely, keeping the tone and style of the original.',
  'Keep proper nouns, numbers, units and technical terms natural in the target language.',
  'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
  'The JSON must match this shape exactly:',
  '{"translations":["first translation","second translation"]}',
  'Rules: the translations array must have exactly one entry per input paragraph, in the same order;',
  'each entry contains only the translated text, never the original;',
  'do not merge, split or reorder paragraphs.',
].join(' ');

/** Build the user turn for a paragraph-translation request. */
export function buildTranslateUserPrompt({ paragraphs, language }: TranslateRequest): string {
  const numbered = paragraphs.map((paragraph, index) => `${index + 1}. ${paragraph.text}`).join('\n');
  return [
    `Translate the ${paragraphs.length} paragraph(s) below into ${language}.`,
    'Respond with JSON only.',
    '',
    numbered,
  ].join('\n');
}

/**
 * System instruction for the word-by-word (interlinear) alignment mode. The
 * model returns, per paragraph, a faithful full-sentence translation (kept in
 * natural target word order, which is what we render on the page) plus an
 * ordered list of word glosses for the hover popover.
 */
export const ALIGN_SYSTEM_PROMPT = [
  'You are a professional translator producing an interlinear (word-by-word) bilingual edition.',
  'For EACH paragraph, return TWO things:',
  '1) "translation": the full paragraph translated into the target language, in natural, correct word order (a complete sentence — never word-by-word order).',
  '2) "pairs": an ordered list of glosses — ONE entry per token in the source, in the SAME order as the source text, with NO omissions and NO added words.',
  'Rules for "pairs":',
  '- the "source" field repeats the original token VERBATIM (including case and internal punctuation such as dots or hyphens, e.g. keep "Node.js" as one token);',
  '- the "target" field is ONLY that single token\'s translation — a SINGLE word or short term. NEVER attach surrounding words, pronouns, or particles (e.g. for "Hung" output "Hưng", NOT "tên tôi Hưng").',
  '- if a source token has no clean single-word equivalent, use the shortest possible gloss.',
  'Keep proper nouns, numbers, units and technical terms natural in the target language.',
  'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
  'The JSON must match this shape exactly, with one entry per input paragraph in order:',
  '{"paragraphs":[{"translation":"<full sentence in target language>","pairs":[{"source":"Original token","target":"single-word gloss"}]}]}',
].join(' ');

/** Build the user turn for a word-alignment request. */
export function buildAlignUserPrompt({ paragraphs, language }: TranslateRequest): string {
  const numbered = paragraphs.map((paragraph, index) => `${index + 1}. ${paragraph.text}`).join('\n');
  return [
    `Produce a word-by-word alignment for the ${paragraphs.length} paragraph(s) below into ${language}.`,
    'Respond with JSON only.',
    '',
    numbered,
  ].join('\n');
}

