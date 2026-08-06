/**
 * Normalise a word or phrase into a stable lookup key:
 * lowercased, trimmed and whitespace-collapsed.
 */
export function normalizeWord(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Collapse runs of whitespace and trim, preserving original casing. */
export function collapseWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

/** Normalise a tag: lowercase, whitespace-collapsed, no leading '#'. */
export function normalizeTag(tag: string): string {
  return normalizeWord(tag.replace(/^#+/, ''));
}

/** Normalise and de-duplicate a list of tags, dropping empties. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (normalized) seen.add(normalized);
  }
  return [...seen].sort();
}

/** Escape a string for safe interpolation into a RegExp. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches one "word-like" token so the gloss wrapper and the keyless word
 * aligner agree on boundaries.
 *
 * A token starts and ends with a letter/number, and may contain letters,
 * numbers, Unicode combining marks (so accented letters like naïve/résumé stay
 * whole), and word-internal punctuation: apostrophe `'`, curly quotes `‘’`,
 * hyphen `-` (so `self-contained`, `state-of-the-art` stay whole), period `.`
 * (abbreviations like `U.S.A.`, `e.g.`), and the common "attaching" symbols
 * `# $ % & * + = @ ~ _` (so `C#`, `C++`, `key=value`, `word@domain` stay one
 * term instead of being split by the symbol).
 *
 * Deliberately EXCLUDED from the internal set: em/en dashes `– —` and middle dot
 * `·`. Real text uses them between words ("hello—world", "section·item"), and
 * treating them as internal would wrongly merge two words into one token (and
 * then fail to match either word, dropping both glosses). They are separators.
 *
 * Punctuation that is NOT word-internal (`:`, `,`, `(`, `“`, etc.) is excluded,
 * so "read: this" and "(note)" yield separate word tokens.
 */
export const WORD_TOKEN = /([\p{L}\p{N}][\p{L}\p{N}\p{M}'’‘.#$%&*+=@~_-]*(?:[\p{L}\p{N}]|[#$%&*+=@~_]+)|[\p{L}]|[\p{N}])/gu;

/**
 * Split text into word-like tokens, including adjacent two-word phrases.
 *
 * A single word is always emitted. In addition, when two word tokens sit next
 * to each other separated by exactly one space, the two-word phrase is also
 * emitted (e.g. "ice cream", "break down") so the bilingual reader can translate
 * and gloss a short phrase as one unit, not just isolated words.
 */
export function tokenizeWords(text: string): string[] {
  const matches = [...text.matchAll(WORD_TOKEN)];
  const singles = matches.map((m) => m[0]);
  const positions = matches.map((m) => m.index ?? 0);
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (token: string): void => {
    const key = token.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(token);
    }
  };
  for (const word of singles) add(word);
  for (let i = 0; i < singles.length - 1; i += 1) {
    const current = singles[i];
    const next = singles[i + 1];
    if (!current || !next) continue;
    const curPos = positions[i];
    const nextPos = positions[i + 1];
    if (curPos === undefined || nextPos === undefined) continue;
    // Adjacent only when exactly one space separates the two tokens.
    if (nextPos === curPos + current.length + 1) {
      add(`${current} ${next}`);
    }
  }
  return out;
}

/** Matches terminal punctuation that can end a sentence. */
const SENTENCE_TERMINATORS = /[.!?。！？]/u;

/** Common abbreviations whose trailing period is not a sentence boundary. */
const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'u.s', 'u.k']);

/** A single-letter initial ("J. Smith"), lowercased by normalizeSentenceToken. */
const INITIAL = /^[a-z]$/u;

/** Fold a boundary candidate token into a comparable key ("Mr." → "mr"). */
function normalizeSentenceToken(token: string): string {
  return token.toLowerCase().replace(/[.']+$/u, '');
}

/**
 * True when the terminator at `index` does NOT close a sentence: it is a
 * decimal/version number, a known abbreviation or a single-letter initial.
 */
function isIntraSentenceBoundary(text: string, index: number): boolean {
  const char = text[index];
  const prev = text[index - 1];
  const next = text[index + 1];
  if (char === '.' && prev && next && /\d/.test(prev) && /\d/.test(next)) return true;
  if (char !== '.') return false;

  const token = normalizeSentenceToken(cutBackwards(text, index));
  if (ABBREVIATIONS.has(token)) return true;
  if (INITIAL.test(token)) return true;
  return false;
}

/** The word token ending at `index`, including internal periods ("U.S."). */
function cutBackwards(text: string, index: number): string {
  let end = index + 1;
  while (end < text.length && /[.']/u.test(text[end] ?? '')) end += 1;
  let start = index - 1;
  while (start >= 0 && /[\p{L}.']/u.test(text[start] ?? '')) start -= 1;
  return text.slice(start + 1, end);
}

/**
 * Split a paragraph into sentences. Each returned sentence keeps its terminal
 * punctuation and any trailing closing quotes/brackets. Guards against splitting
 * on common abbreviations, single-letter initials and decimal/version numbers.
 * Empty input yields an empty array.
 */
export function splitIntoSentences(input: string): string[] {
  const text = input.trim();
  if (!text) return [];

  const sentences: string[] = [];
  let sentenceStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (!char || !SENTENCE_TERMINATORS.test(char)) continue;
    if (isIntraSentenceBoundary(text, index)) continue;

    let end = index + 1;
    while (end < text.length && /[」』”’)\]＞]/.test(text[end] ?? '')) end += 1;
    // For Latin text a terminator followed by letters/digits with no space is
    // mid-sentence (e.g. a URL), so only close when the rest is blank or starts
    // with a space. CJK sentences are not space-delimited, so always split.
    if (char !== '。' && char !== '！' && char !== '？') {
      const rest = text[end];
      if (rest !== undefined && !/\s/u.test(rest)) continue;
    }

    sentences.push(text.slice(sentenceStart, end).trim());
    sentenceStart = end;
  }

  if (sentenceStart < text.length) {
    const tail = text.slice(sentenceStart).trim();
    if (tail) sentences.push(tail);
  }

  return sentences.filter((sentence) => sentence.length > 0);
}

const SENTENCE_BOUNDARY = /[.!?。！？]\s|\n/;

/**
 * Extract the sentence containing `selection` from `haystack`.
 * Falls back to a windowed excerpt when no sentence boundary is found.
 */
export function extractSentence(haystack: string, selection: string, window = 160): string {
  const text = collapseWhitespace(haystack);
  const needle = collapseWhitespace(selection);
  if (!text || !needle) return needle;

  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return needle;

  let start = 0;
  for (let i = index; i > 0; i -= 1) {
    if (SENTENCE_BOUNDARY.test(text.slice(i - 1, i + 1))) {
      start = i + 1;
      break;
    }
  }
  let end = text.length;
  for (let i = index + needle.length; i < text.length; i += 1) {
    if (SENTENCE_BOUNDARY.test(text.slice(i, i + 2))) {
      end = i + 1;
      break;
    }
  }

  const sentence = text.slice(start, end).trim();
  if (sentence.length <= window * 2) return sentence;
  const from = Math.max(0, index - window);
  const to = Math.min(text.length, index + needle.length + window);
  return `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`;
}

/** True when the selection contains more than one whitespace-separated token. */
export function isPhrase(input: string): boolean {
  return collapseWhitespace(input).includes(' ');
}

const SCRIPT_RANGES: ReadonlyArray<readonly [string, RegExp]> = [
  ['Chinese', /[⺀-鿿豈-﫿]/],
  ['Japanese', /[぀-ヿ]/],
  ['Hangul', /[가-힯]/],
  ['Cyrillic', /[Ѐ-ӿ]/],
  ['Arabic', /[؀-ۿݐ-ݿ]/],
  ['Devanagari', /[ऀ-ॿ]/],
  ['Thai', /[฀-๿]/],
  ['Greek', /[Ͱ-Ͽ]/],
];

const LATIN = /[A-Za-z]/;

/**
 * Best-effort source-language detection from Unicode script coverage.
 * Not a full classifier — it answers the one question the explainer needs:
 * "what script is this word in?" so translation can run source → target.
 * Returns a BCP-47-ish label, or '' when nothing recognisable is present.
 */
export function detectLanguage(text: string): string {
  const sample = collapseWhitespace(text);
  if (!sample) return '';

  for (const [label, range] of SCRIPT_RANGES) {
    if (range.test(sample)) return label;
  }
  if (LATIN.test(sample)) return 'English';
  return '';
}
