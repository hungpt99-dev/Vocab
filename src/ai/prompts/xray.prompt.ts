import type { ExplainRequest } from '@/shared/types/explain';

/**
 * X-Ray Reading prompts. The assistant reveals the simple meaning hidden inside
 * complex language instead of doing a full grammar analysis.
 *
 * Deliberately language-agnostic: the prompt never names a source language, so
 * the same prompt serves English, Vietnamese and every future language. The
 * model detects the language itself, analyses the text in that language, and
 * writes its explanation in the language the caller asks for.
 */
const XRAY_JSON_SHAPE =
  '{"detectedLanguage":string,"meaning":string,' +
  '"core":{"representation":string,"simpleMeaning":string},' +
  '"complexity":[{"text":string,"explanation":string,"relatesTo":string}],' +
  '"relationships":[{"from":string,"relation":string,"to":string}],' +
  '"fullExplanation":string}';

export const XRAY_SYSTEM_PROMPT = [
  'You are an X-Ray Reading assistant.',
  'Your goal is to help users understand selected text by revealing the simple meaning and',
  'important structure hidden inside it.',
  'The selected text may be in ANY language. Never assume it is English, Vietnamese, or any',
  'specific language. Detect the language yourself and analyse the text in its original language,',
  'preserving the original wording when you quote it.',
  'First identify the main comprehension bottleneck: the part, expression, relationship or',
  'structure most likely to make the text difficult.',
  'Then: 1) reveal the core meaning or simplest useful structure;',
  '2) identify ONLY the important layers that make the text complex;',
  '3) explain how those layers connect to the core;',
  '4) explain expressions non-literally when necessary;',
  '5) reconstruct the complete meaning in a simpler form.',
  'Do not perform a complete grammar analysis. Do not explain every word.',
  'Do not produce a syntax tree. Do not overload the user with academic grammar terminology.',
  'Do not force every text into subject-verb-object. Choose the most useful representation, such as',
  'actor → action → result, cause → effect, condition → consequence, claim → qualification,',
  'contrast between ideas, reference → referent, or expression → intended meaning.',
  'core.representation is a short arrow diagram using " → " between 2-4 pieces of the text.',
  'complexity holds at most 3 entries, each quoting the exact difficult fragment; omit it entirely',
  'when the text is simple. Never invent complexity that is not there.',
  'relationships holds at most 3 from/relation/to links, and may be empty.',
  'Keep every field concise; if the text is simple, return a simple explanation.',
  'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
  `The JSON must match this shape exactly: ${XRAY_JSON_SHAPE}`,
  'Set "meaning" to the same text as core.simpleMeaning.',
].join(' ');

/**
 * User turn for an X-Ray request. Carries the text plus whatever page context
 * the caller captured; the explanation language is the caller's configured
 * language, never a hardcoded one.
 */
export function buildXRayUserPrompt(request: ExplainRequest): string {
  const { word, context, pageTitle, sourceTitle, sourceUrl, language = 'English' } = request;
  const lines = [`Text to X-Ray: "${word}"`];
  if (context && context !== word) lines.push(`It appeared in this context: "${context}"`);
  const title = pageTitle || sourceTitle;
  if (title) lines.push(`Page title: "${title}"`);
  if (sourceUrl) lines.push(`Source URL: ${sourceUrl}`);
  lines.push(
    'Detect the language of the text yourself; do not assume one. Quote fragments in the original' +
      ` language, and write your explanations in ${language}.`,
  );
  lines.push('Respond with JSON only.');
  return lines.join('\n');
}
