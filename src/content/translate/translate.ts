import { sendMessage } from '@/shared/messaging/client';
import { translatePage, type TranslateResult } from './engine';

export interface TranslatePageOptions {
  /** Root to translate; defaults to the document body. */
  root?: ParentNode;
  /** Target language override; falls back to the user's settings. */
  language?: string;
  /** Abort signal, checked between units (in-flight provider calls finish). */
  signal?: AbortSignal;
}

/**
 * Translate the current page paragraph-by-paragraph. The AI call is delegated
 * to the background via the message bus — the content script never touches a
 * provider SDK, so it stays provider-agnostic.
 */
export async function translateCurrentPage(
  options: TranslatePageOptions = {},
): Promise<TranslateResult> {
  const root = options.root ?? document.body;
  return translatePage(root, {
    translate: (source) =>
      sendMessage({ type: 'translate', payload: { text: source, language: options.language } }),
    isCancelled: () => options.signal?.aborted ?? false,
  });
}
