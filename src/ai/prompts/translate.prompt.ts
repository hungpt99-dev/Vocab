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
 * model returns an ordered list of source→target glosses, one per token, so the
 * content script can render each original word with its translation beneath it.
 */
export const ALIGN_SYSTEM_PROMPT = [
  'You are a professional translator producing an interlinear (word-by-word) bilingual edition.',
  'For each paragraph, return an ordered list of glosses — one entry per token in the source,',
  'in the same order, with no omissions and no added words.',
  'Keep proper nouns, numbers, units and technical terms natural in the target language.',
  'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
  'The JSON must match this shape exactly:',
  '{"pairs":[{"source":"Original token","target":"Target gloss"}, ...]}',
  'Rules: the pairs array must have exactly one entry per source token, in order;',
  'the source field repeats the original token verbatim;',
  'the target field is its translation in the target language.',
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

