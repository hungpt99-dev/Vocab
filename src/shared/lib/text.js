/**
 * Normalise a word or phrase into a stable lookup key:
 * lowercased, trimmed and whitespace-collapsed.
 */
export function normalizeWord(input) {
    return input.trim().toLowerCase().replace(/\s+/g, ' ');
}
/** Collapse runs of whitespace and trim, preserving original casing. */
export function collapseWhitespace(input) {
    return input.trim().replace(/\s+/g, ' ');
}
/** Normalise a tag: lowercase, whitespace-collapsed, no leading '#'. */
export function normalizeTag(tag) {
    return normalizeWord(tag.replace(/^#+/, ''));
}
/** Normalise and de-duplicate a list of tags, dropping empties. */
export function normalizeTags(tags) {
    const seen = new Set();
    for (const tag of tags) {
        const normalized = normalizeTag(tag);
        if (normalized)
            seen.add(normalized);
    }
    return [...seen].sort();
}
/** Escape a string for safe interpolation into a RegExp. */
export function escapeRegExp(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const SENTENCE_BOUNDARY = /[.!?。！？]\s|\n/;
/**
 * Extract the sentence containing `selection` from `haystack`.
 * Falls back to a windowed excerpt when no sentence boundary is found.
 */
export function extractSentence(haystack, selection, window = 160) {
    const text = collapseWhitespace(haystack);
    const needle = collapseWhitespace(selection);
    if (!text || !needle)
        return needle;
    const index = text.toLowerCase().indexOf(needle.toLowerCase());
    if (index === -1)
        return needle;
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
    if (sentence.length <= window * 2)
        return sentence;
    const from = Math.max(0, index - window);
    const to = Math.min(text.length, index + needle.length + window);
    return `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`;
}
/** True when the selection contains more than one whitespace-separated token. */
export function isPhrase(input) {
    return collapseWhitespace(input).includes(' ');
}
