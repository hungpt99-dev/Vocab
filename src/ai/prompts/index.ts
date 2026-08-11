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
export { XRAY_SYSTEM_PROMPT, buildXRayUserPrompt } from './xray.prompt';
export { TRANSLATE_SYSTEM_PROMPT, buildTranslateUserPrompt } from './translate.prompt';
export { GOAL_SYSTEM_PROMPT_V1, GOAL_PROMPT_VERSION, buildGoalUserPrompt } from './goal.prompt';
export { ALIGN_SYSTEM_PROMPT, buildAlignUserPrompt } from './translate.prompt';
