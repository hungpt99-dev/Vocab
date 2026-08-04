import type { WordAlignResult, WordPair } from '@/ai/types';

/**
 * Word-by-word reading: wrap each source word that has a target-language gloss
 * in a lightweight inline span. The page stays fully readable; the gloss itself
 * is revealed in a small popover when the reader hovers a word (see
 * WordGlossPopover). Unmatched words are left untouched.
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

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node as Text);

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? '';
    // Split on word boundaries but keep the words so we can re-wrap them.
    const parts = text.split(/(\b[\p{L}\p{N}']+\b)/u);
    if (parts.length <= 1) continue;

    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      const target = bySource.get(part.toLowerCase());
      if (target && part.trim()) {
        const span = document.createElement('span');
        span.className = 'avs-gloss-word';
        span.dataset.avsGloss = target;
        span.textContent = part;
        fragment.append(span);
      } else {
        fragment.append(document.createTextNode(part));
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
