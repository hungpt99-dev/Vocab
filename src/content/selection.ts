import { collapseWhitespace, extractSentence } from '@/shared/lib/text';
import type { SelectionPayload } from '@/shared/messaging/contract';

/** Read the current document selection along with its surrounding sentence. */
export function readSelection(doc: Document = document): SelectionPayload | null {
  const selection = doc.getSelection();
  const word = collapseWhitespace(selection?.toString() ?? '');
  if (!word) return null;

  const container = selection?.anchorNode?.parentElement;
  const surrounding = container?.textContent ?? '';

  return {
    word,
    sentence: extractSentence(surrounding, word),
    sourceUrl: doc.location?.href ?? '',
    sourceTitle: doc.title ?? '',
  };
}
