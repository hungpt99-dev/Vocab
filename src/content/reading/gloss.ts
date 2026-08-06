import type { WordAlignResult, WordPair } from '@/ai/types';

/**
 * Word-by-word reading: wrap each source word (or two-word phrase) that has a
 * target-language gloss in a lightweight inline span. The page stays fully
 * readable; the gloss itself is revealed in a small popover when the reader
 * hovers a word (see WordGlossPopover). Unmatched words are left untouched.
 *
 * `root` is mutated in place. Callers must keep the original `innerHTML` so the
 * wrap can be undone when bilingual reading is turned off or re-rendered.
 */
export function wrapWords(root: HTMLElement, result: WordAlignResult): void {
  if (result.pairs.length === 0) return;

  const bySource = new Map<string, string>();
  for (const pair of result.pairs) {
    if (pair.target) bySource.set(pair.source.toLowerCase(), pair.target);
  }
  if (bySource.size === 0) return;

  // Longest phrases first so a two-word phrase ("ice cream") is preferred over
  // its constituent single words when both are present.
  const phrases = [...bySource.keys()].sort((a, b) => b.length - a.length);

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node as Text);

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? '';
    if (!text) continue;

    const fragment = document.createDocumentFragment();
    let i = 0;
    while (i < text.length) {
      const rest = text.slice(i).toLowerCase();
      // Prefer the longest known phrase that starts here.
      const phrase = phrases.find((p) => rest.startsWith(p.toLowerCase()) && p.length > 0);
      if (phrase) {
        const span = document.createElement('span');
        span.className = 'avs-gloss-word';
        span.dataset.avsGloss = bySource.get(phrase.toLowerCase()) ?? '';
        span.textContent = text.slice(i, i + phrase.length);
        fragment.append(span);
        i += phrase.length;
      } else {
        fragment.append(document.createTextNode(text[i] ?? ''));
        i += 1;
      }
    }
    textNode.replaceWith(fragment);
  }
}

/** A compact sentence-level translation line (also the no-alignment fallback). */
export function buildSentenceBlock(translation: string): HTMLElement {
  const line = document.createElement('div');
  line.className = 'avs-inline-translation';
  line.textContent = translation;
  return line;
}

export function pairsToText(pairs: WordPair[]): string {
  return pairs.map((pair) => pair.target).join(' ').trim();
}
