import { escapeRegExp } from '@/shared/lib/text';
import type { HighlightData } from '@/shared/messaging/contract';

export type HighlightEntry = HighlightData['entries'][number];

export interface Match {
  start: number;
  end: number;
  entry: HighlightEntry;
}

/**
 * Compiles saved vocabulary into a single word-boundary regular expression so
 * scanning a page costs one pass per text node instead of one pass per word.
 */
export class VocabularyMatcher {
  private readonly byKey = new Map<string, HighlightEntry>();
  private readonly pattern: RegExp | null;

  constructor(entries: readonly HighlightEntry[]) {
    for (const entry of entries) {
      if (entry.wordKey) this.byKey.set(entry.wordKey, entry);
    }

    const keys = [...this.byKey.keys()].sort((a, b) => b.length - a.length);
    this.pattern = keys.length
      ? new RegExp(`(?<![\\p{L}\\p{N}])(${keys.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
      : null;
  }

  get size(): number {
    return this.byKey.size;
  }

  /** Find every saved word inside a piece of text. */
  findAll(text: string): Match[] {
    if (!this.pattern || !text) return [];
    this.pattern.lastIndex = 0;

    const matches: Match[] = [];
    for (const found of text.matchAll(this.pattern)) {
      const value = found[0];
      const index = found.index;
      if (index === undefined) continue;
      const entry = this.byKey.get(value.toLowerCase().replace(/\s+/g, ' '));
      if (entry) matches.push({ start: index, end: index + value.length, entry });
    }
    return matches;
  }
}
