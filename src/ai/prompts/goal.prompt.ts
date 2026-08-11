import type { VocabularyGoal } from '@/features/goal/types';

/**
 * System prompt for Vocabulary Goal Mode. Centralised and versioned so the
 * strategy can evolve without touching the service or UI. Returns ONLY the
 * documented JSON shape — no prose, no markdown fences.
 */
export const GOAL_SYSTEM_PROMPT_V1 = [
  'You are helping a language learner discover English words and phrases that are useful for their personal learning goal.',
  'You are given a user goal and a portion of text from a web page the learner is reading.',
  'Select only vocabulary (single words or short multi-word expressions) that actually appears in the provided text.',
  'Prioritise items relevant to the user’s goal: domain terminology, useful phrases, collocations, and natural reusable expressions.',
  'Prefer concrete, reusable language over vague or decorative words.',
  'Avoid: very basic vocabulary, random difficult words with little practical value, proper names (unless educationally useful),',
  'duplicate concepts, and phrases that are not meaningful standalone expressions.',
  'Do not invent text that is not present in the provided text.',
  'Return valid JSON only, matching this shape exactly:',
  '{ "candidates": [ { "text": string, "type": "word" | "phrase", "score": number between 0 and 100, "reason": string, "context": string } ] }',
  'Rules for each candidate: text is the exact surface form from the text; type is "word" or "phrase";',
  'score is 0-100 and reflects relevance to the goal (90-100 highly relevant, 70-89 relevant);',
  'reason is one concise sentence on why it helps the learner; context is a real sentence from the text containing the item, when possible.',
  'Return at most 5 high-quality candidates for the given text. If nothing is worth suggesting, return {"candidates":[]}.',
].join(' ');

export const GOAL_PROMPT_VERSION = 'goal-v1';

/** Build the user turn for a goal analysis request. */
export function buildGoalUserPrompt(params: {
  goal: VocabularyGoal;
  text: string;
}): string {
  const { goal, text } = params;
  const lines: string[] = [];

  lines.push(`User goal: ${goal.text}`);

  const metaBits: string[] = [];
  if (goal.domains?.length) metaBits.push(`domains: ${goal.domains.join(', ')}`);
  if (goal.topics?.length) metaBits.push(`topics: ${goal.topics.join(', ')}`);
  if (goal.situations?.length) metaBits.push(`situations: ${goal.situations.join(', ')}`);
  if (metaBits.length) lines.push(`Goal details (optional hints): ${metaBits.join('; ')}`);

  lines.push('');
  lines.push('Page text (analyze only this):');
  lines.push(text);
  lines.push('');
  lines.push('Respond with JSON only.');

  return lines.join('\n');
}
