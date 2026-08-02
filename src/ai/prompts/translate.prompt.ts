import type { TranslateRequest } from '../types';

/**
 * System instruction for the "translate a block" capability. Kept separate from
 * any provider adapter so the prompt strategy can evolve without touching the
 * transport code. Translation must be a faithful, fluent rendering with no
 * annotation so the result can be displayed verbatim next to the original.
 */
export const TRANSLATE_SYSTEM_PROMPT = [
  'You are a professional translator working for a language-learning extension.',
  'Translate the text the user provides into the requested language.',
  'Preserve the meaning, tone and paragraph breaks exactly.',
  'Do not explain, annotate, quote, comment or add anything.',
  'Return only the translation — no leading text, no markdown fences.',
].join(' ');

/** Build the user turn for a translation request. */
export function buildTranslateUserPrompt({ text, language }: TranslateRequest): string {
  return `Translate the following text into ${language}.\n\n${text}`;
}
