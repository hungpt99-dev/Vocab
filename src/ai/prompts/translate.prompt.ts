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
