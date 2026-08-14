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

/**
 * Map a settings language (display name, bare code, or full locale) to a
 * BCP-47 locale with a region, for APIs that need one (e.g. SpeechSynthesis).
 * Reuses `toLanguageCode` so the name→code mapping lives in exactly one place.
 * A bare code with no region (e.g. "fr") is expanded to its default region
 * ("fr-FR"); an already-regional locale ("fr-FR", "en-US") is returned as-is;
 * anything unrecognised falls back to the code itself.
 */
const DEFAULT_LOCALES: Record<string, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  id: 'id-ID',
  th: 'th-TH',
  ar: 'ar-SA',
  hi: 'hi-IN',
  nl: 'nl-NL',
  tr: 'tr-TR',
  pl: 'pl-PL',
  uk: 'uk-UA',
  cs: 'cs-CZ',
  ro: 'ro-RO',
  el: 'el-GR',
  hu: 'hu-HU',
  sv: 'sv-SE',
  no: 'nb-NO',
  da: 'da-DK',
  fi: 'fi-FI',
  he: 'he-IL',
  bn: 'bn-BD',
  ta: 'ta-IN',
  ur: 'ur-PK',
  fil: 'fil-PH',
  ms: 'ms-MY',
};

export function toLocale(input: string): string {
  const code = toLanguageCode(input);
  // Already a regional locale (e.g. "fr-FR", "en-US") — keep it.
  if (/^[a-z]{2}-[A-Z]{2}$/i.test(code)) return code;
  return DEFAULT_LOCALES[code.toLowerCase()] ?? code;
}
