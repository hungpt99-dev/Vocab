import { sendMessage } from '@/shared/messaging/client';

/**
 * Keyless Google translation of a single word/phrase into the user's target
 * language — the same service bilingual reading uses, so it works without an
 * AI key. Returns the translated text, or `''` when the call fails or the
 * source comes back unchanged (i.e. already in the target language).
 *
 * This is the single network path for "translate one saved word"; `EntryCard`
 * and the save flows both go through it so the result can be cached on the
 * entry at save time (see VOC-178) instead of re-fetched on every render.
 */
export async function translateText(text: string): Promise<string> {
  const source = text.trim();
  if (!source) return '';
  try {
    const result = await sendMessage({ type: 'translate', payload: { text: source } });
    if (typeof result === 'string' && result && result !== source) return result;
    return '';
  } catch {
    return '';
  }
}
