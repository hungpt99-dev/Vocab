/**
 * Language-agnostic, text-level normalization of a raw word before any
 * linguistic processing.
 *
 * This stage is intentionally NON-linguistic and works for every language: it
 * only cleans the surface of the string:
 *   - trims surrounding whitespace
 *   - normalizes Unicode (NFC) so accented letters and compatibility
 *     equivalents collapse to a single canonical code point, and full-width
 *     forms fold to their half-width equivalents
 *   - lowercases (so `BOOKS` and `books` are the same normalized form)
 *   - strips a small set of enclosing/irrelevant punctuation that browsers and
 *     users routinely drag along with a selection (quotes, brackets, trailing
 *     periods, dashes, bullet markers), without touching internal punctuation
 *     that belongs to the word (hyphens, apostrophes, periods in abbreviations,
 *     CJK markers)
 *
 * It must NOT singularize or lemmatize. `books` stays `books` here; reducing it
 * to `book` is the job of the (AI-backed) linguistic analyzer.
 */
export interface WordNormalizer {
  normalize(word: string): string;
}

/** Characters trimmed from both ends of the selection (but never mid-word). */
const TRIM_PUNCTUATION =
  /^[`"'“”‘’()[\]{}«»‹›「」『』〈〉《》.…:;,!?\-–—/\\*_=+#@~^|]+|[`"'“”‘’()[\]{}«»‹›「」『』〈〉《》.…:;,!?\-–—/\\*_=+#@~^|]+$/gu;

/** Full-width ASCII variants -> half-width (e.g. ＡＢＣ -> abc). */
function foldWidth(input: string): string {
  return input.replace(/[！-～]/gu, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

export class DefaultWordNormalizer implements WordNormalizer {
  normalize(word: string): string {
    if (typeof word !== 'string') return '';
    // 1. Collapse whitespace and trim.
    let result = word.replace(/\s+/gu, ' ').trim();
    if (!result) return '';
    // 2. Fold full-width characters to half-width before lowercasing.
    result = foldWidth(result);
    // 3. Unicode normalization so equivalent code points compare equal.
    result = result.normalize('NFC');
    // 4. Strip irrelevant surrounding punctuation (repeat for nested pairs).
    let stripped = result.replace(TRIM_PUNCTUATION, '');
    let guard = 0;
    while (stripped.length < result.length && guard < 8) {
      result = stripped;
      stripped = result.replace(TRIM_PUNCTUATION, '');
      guard += 1;
    }
    result = stripped;
    if (!result) return '';
    // 5. Lowercase last (so Unicode case folding is applied to clean input).
    return result.toLowerCase();
  }
}

export const wordNormalizer: WordNormalizer = new DefaultWordNormalizer();
