/** Selection granularity an explanation is requested for. */
export type ExplainUnit = 'word' | 'phrase' | 'sentence';

/** Full-context AI explanation request, produced by the content script and sent via the message bus. */
export interface ExplainRequest {
  /** The selected text: a word, phrase or sentence. */
  word: string;
  /** Which unit the selection was classified as; drives the structured sections. */
  unit?: ExplainUnit;
  /** Surrounding paragraph/sentence the selection appeared in. */
  context?: string;
  /** Source page URL the selection came from. */
  sourceUrl?: string;
  /** Source page title. */
  sourceTitle?: string;
  /** Detected source language (BCP-47-ish label). */
  sourceLanguage?: string;
  /** Preferred (target) language for the explanation. */
  language?: string;
}
