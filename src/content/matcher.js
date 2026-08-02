import { escapeRegExp } from '@/shared/lib/text';
/**
 * Compiles saved vocabulary into a single word-boundary regular expression so
 * scanning a page costs one pass per text node instead of one pass per word.
 */
export class VocabularyMatcher {
    byKey = new Map();
    pattern;
    constructor(entries) {
        for (const entry of entries) {
            if (entry.wordKey)
                this.byKey.set(entry.wordKey, entry);
        }
        const keys = [...this.byKey.keys()].sort((a, b) => b.length - a.length);
        this.pattern = keys.length
            ? new RegExp(`(?<![\\p{L}\\p{N}])(${keys.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
            : null;
    }
    get size() {
        return this.byKey.size;
    }
    /** Find every saved word inside a piece of text. */
    findAll(text) {
        if (!this.pattern || !text)
            return [];
        this.pattern.lastIndex = 0;
        const matches = [];
        for (const found of text.matchAll(this.pattern)) {
            const value = found[0];
            const index = found.index;
            if (index === undefined)
                continue;
            const entry = this.byKey.get(value.toLowerCase().replace(/\s+/g, ' '));
            if (entry)
                matches.push({ start: index, end: index + value.length, entry });
        }
        return matches;
    }
}
