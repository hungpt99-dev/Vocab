/** Selection granularity an explanation is requested for. */
export type ExplainUnit = 'word' | 'phrase' | 'sentence';

/**
 * Full-context AI explanation request, produced by the content script and sent
 * via the message bus. Merges the two prompt models used across the VOC
 * branches: `unit` (selection granularity) and `kind` (analysis kind), plus the
 * page-context fields used for translation-quality context.
 */
export interface ExplainRequest {
  /** The selected text: a word, phrase or sentence. */
  word: string;
  /** Which unit the selection was classified as; drives the structured sections. */
  unit?: ExplainUnit;
  /** Which analysis kind was requested (smart-assist actions). */
  kind?: 'word' | 'sentence' | 'grammar' | 'vocabulary' | 'simplify' | 'summarize';
  /** Surrounding paragraph/sentence the selection appeared in. */
  context?: string;
  /** Source page URL the selection came from. */
  sourceUrl?: string;
  /** Source page title. */
  sourceTitle?: string;
  /** Page title forwarded from the content script (alias of sourceTitle). */
  pageTitle?: string;
  /** Short excerpt of text immediately before the selection on the page. */
  precedingText?: string;
  /** Detected source language (BCP-47-ish label). */
  sourceLanguage?: string;
  /** Preferred (target) language for the explanation. */
  language?: string;
  /** Optional user-editable system-prompt template (tokens: {{language}} {{word}} {{context}} {{kind}}). */
  promptTemplate?: string;
}
