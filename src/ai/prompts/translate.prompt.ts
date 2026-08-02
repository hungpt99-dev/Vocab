import type { TranslateRequest } from '../types';

/**
 * System instruction for the "translate a page unit" capability. Each unit is a
 * single paragraph, heading, list item or other text block, so the model is told
 * to keep the `[[number]]` markers that anchor inline markup exactly as written.
 * Kept separate from any provider adapter so the strategy can evolve without
 * touching the transport code.
 */
export const TRANSLATE_SYSTEM_PROMPT = [
  'You are a professional translator working inside a browser extension.',
  'Translate the user text into the requested target language.',
  'Keep every marker of the form [[number]] exactly as written and in the same order.',
  'Keep URLs, code, proper nouns and numbers unchanged.',
  'Preserve line breaks between paragraphs.',
  'Do not add explanations, notes or surrounding quotation marks.',
  'Return only the translation itself, with no markdown fences.',
].join(' ');

/** Build the user turn for a per-unit translation request. */
export function buildTranslateUserPrompt({ text, language = 'English' }: TranslateRequest): string {
  return [
    `Translate the following text into ${language}.`,
    'Keep every [[number]] marker exactly as written.',
    '',
    text,
  ].join('\n');
}
