/**
 * Which analysis the AI should produce for a piece of selected text.
 * Drives the prompt every provider receives and the labels surfaced in the
 * content script's smart-assistance menu. Shared so the message contract and
 * the background explainer agree on the same set without provider coupling.
 */
export type ExplainKind =
  | 'word'
  | 'sentence'
  | 'grammar'
  | 'vocabulary'
  | 'simplify'
  | 'summarize'
  | 'examples'
  | 'native'
  | 'related';
