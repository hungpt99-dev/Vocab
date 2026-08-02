import { collapseWhitespace, detectLanguage, extractSentence } from '@/shared/lib/text';
import type { SelectionPayload } from '@/shared/messaging/contract';

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
    sourceUrl: doc.location?.href ?? '',
    sourceTitle: doc.title ?? '',
    sourceLanguage: detectLanguage(word),
  };
}
