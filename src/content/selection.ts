import { collapseWhitespace, detectLanguage, extractSentence } from '@/shared/lib/text';
import type { SelectionPayload } from '@/shared/messaging/contract';

/** Characters of raw text to keep when excerpting what precedes the selection. */
const PRECEDING_WINDOW = 200;

/** A short, whitespace-normalised excerpt of the text before the selection. */
function extractPrecedingText(surrounding: string, word: string, window = PRECEDING_WINDOW): string {
  const text = collapseWhitespace(surrounding);
  const needle = collapseWhitespace(word);
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return '';
  const start = Math.max(0, index - window);
  const excerpt = text.slice(start, index).trim();
  return `${start > 0 ? '…' : ''}${excerpt}`;
}

/** Read the current document selection along with its surrounding sentence. */
export function readSelection(doc: Document = document): SelectionPayload | null {
  const selection = doc.getSelection();
  const word = collapseWhitespace(selection?.toString() ?? '');
  if (!word) return null;
  return buildSelectionPayload(word, selection?.anchorNode ?? null, doc);
}

/**
 * Build a capture payload for an explicit selection. The surrounding sentence
 * is read from the selection's block container, so the payload keeps its
 * context even after the live selection has been cleared from the page.
 */
export function buildSelectionPayload(
  word: string,
  contextNode: Node | null,
  doc: Document = document,
): SelectionPayload {
  const surrounding = contextNode?.parentElement?.textContent ?? '';
  return {
    word,
    sentence: extractSentence(surrounding, word),
    precedingText: extractPrecedingText(surrounding, word),
    sourceUrl: doc.location?.href ?? '',
    sourceTitle: doc.title ?? '',
    sourceLanguage: detectLanguage(word),
  };
}
