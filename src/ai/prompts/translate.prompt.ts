import type { TranslateRequest } from '../types';

/**
 * System instruction for the "translate text" capability. Kept separate from
 * any provider adapter so the prompt strategy can evolve without touching the
 * transport code.
 */
export const TRANSLATE_SYSTEM_PROMPT = [
  'You are a professional translator.',
  'Translate the user text into the requested target language.',
  'Respond with only the translation — no commentary, no quotes, no notes, no formatting.',
].join(' ');

/** Build the user turn for a translation request. */
export function buildTranslateUserPrompt({
  text,
  targetLanguage,
  sourceLanguage,
}: TranslateRequest): string {
  const lines = [`Translate the following text into ${targetLanguage}:`];
  if (sourceLanguage) lines.push(`The source text is in ${sourceLanguage}.`);
  lines.push(`Source text: "${text}"`);
  return lines.join('\n');
}
