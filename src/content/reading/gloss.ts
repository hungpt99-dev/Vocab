import type { WordAlignResult, WordPair } from '@/ai/types';
import { WORD_TOKEN } from '@/shared/lib/text';

/**
 * Word-by-word reading: wrap each source word that has a target-language gloss
 * in a lightweight inline span. The page stays fully readable; the gloss itself
 * is revealed in a small popover when the reader hovers a word (see
 * WordGlossPopover). Unmatched words are left untouched.
 *
 * `root` is mutated in place. Callers must keep the original `innerHTML` so the
 * wrap can be undone when bilingual reading is turned off or re-rendered.
 */
/**
 * Matches a single "word-like" token: a run of letters (any script, incl.
 * accents via \p{L}), numbers and internal apostrophes. Crucially we keep
 * internal separators `.` and `-` so `Node.js`, `self-contained` and
 * `State-of-the-art` stay as one token instead of being split apart — this is
 * what lets them match their AI-alignment key (e.g. `node.js`).
 *
 * We deliberately avoid `\b`: JavaScript's `\b` is ASCII-only even with the `u`
 * flag, so accented words (Vietnamese, etc.) would never be recognised as word
 * boundaries and would be skipped. We instead split on a negated character set
 * (anything that is NOT part of a token) and keep the tokens in the result.
 *
 * The shared `WORD_TOKEN` (see @/shared/lib/text) is the single source of truth;
 * it additionally keeps curly quotes/dashes/combining marks so real web text
 * like "it's" (typographic apostrophe) or "naïve" stays whole.
 */
const TOKEN = WORD_TOKEN;

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
    // Split on the non-token gaps but capture the tokens so we can re-wrap them.
    const parts = text.split(TOKEN);
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
