export {
  EXPLAIN_WORD_SYSTEM_PROMPT,
  buildExplainSystemPrompt,
  buildExplainWordUserPrompt,
  buildContextLines,
} from './explain-word.prompt';
export {
  EXPLAIN_PHRASE_SYSTEM_PROMPT,
  EXPLAIN_SENTENCE_SYSTEM_PROMPT,
  buildExplainUserPrompt,
} from './explain-selection.prompt';
export { TRANSLATE_SYSTEM_PROMPT, buildTranslateUserPrompt } from './translate.prompt';
export { ALIGN_SYSTEM_PROMPT, buildAlignUserPrompt } from './translate.prompt';
