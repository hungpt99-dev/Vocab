/**
 * Maps the extension's display-language names (used in settings and prompts) to
 * the ISO-639 codes that machine-translation endpoints expect. The OpenAI/LLM
 * path understands full names, but the keyless Google fallback needs a code.
 */
const LANGUAGE_CODES: Record<string, string> = {
  English: 'en',
  Vietnamese: 'vi',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Italian: 'it',
  Portuguese: 'pt',
  Russian: 'ru',
  Chinese: 'zh-CN',
  Japanese: 'ja',
  Korean: 'ko',
  Indonesian: 'id',
  Thai: 'th',
  Arabic: 'ar',
  Hindi: 'hi',
  Dutch: 'nl',
  Turkish: 'tr',
  Polish: 'pl',
  Ukrainian: 'uk',
  Czech: 'cs',
  // A few common extras not in the picker list.
  Romanian: 'ro',
  Greek: 'el',
  Hungarian: 'hu',
  Swedish: 'sv',
  Norwegian: 'no',
  Danish: 'da',
  Finnish: 'fi',
  Hebrew: 'he',
  Bengali: 'bn',
  Tamil: 'ta',
  Urdu: 'ur',
  Filipino: 'fil',
  Malay: 'ms',
};

/** Resolve a settings language name to an ISO-639 code; default to 'en'. */
export function toLanguageCode(name: string): string {
  const trimmed = name.trim();
  if (LANGUAGE_CODES[trimmed]) return LANGUAGE_CODES[trimmed];
  // Already a code (e.g. "vi", "en-US")? Return as-is.
  if (/^[a-z]{2}(-[A-Z]{2})?$/i.test(trimmed)) return trimmed;
  return 'en';
}
