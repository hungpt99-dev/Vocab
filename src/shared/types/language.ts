import { toLocale } from '@/ai/language-codes';

/**
 * A "full language": the BCP-47 code plus a stable English display name.
 *
 * `targetLanguage` is stored as a `Language` (not a bare string) so the UI can
 * show a native/English name and the translation pipeline can use the code
 * directly without re-deriving it. Historically it was a display-name string
 * ('Vietnamese'); `asLanguage()` converts legacy values on read.
 */
export interface Language {
  /** BCP-47 code, e.g. 'en-US', 'vi-VN', 'ja-JP'. */
  code: string;
  /** English display name, e.g. 'Vietnamese'. Used in prompts and the picker. */
  name: string;
}

export const DEFAULT_LANGUAGE: Language = { code: 'en-US', name: 'English' };

/**
 * Normalise a value into a `Language`. Accepts:
 *  - a `Language` (returned as-is),
 *  - a display name ('Vietnamese') — resolved to its BCP-47 locale,
 *  - a bare code ('vi', 'en-US') — kept, with name = the code,
 *  - anything else — falls back to `fallback` (default English).
 * Used both for the `Settings` migration and for custom (out-of-list) languages
 * the picker may encounter.
 */
export function asLanguage(input: unknown, fallback: Language = DEFAULT_LANGUAGE): Language {
  if (input && typeof input === 'object' && 'code' in input && 'name' in input) {
    const lang = input as Language;
    if (typeof lang.code === 'string' && typeof lang.name === 'string') return lang;
  }
  if (typeof input === 'string' && input.trim()) {
    const name = input.trim();
    return { code: toLocale(name), name };
  }
  return fallback;
}
