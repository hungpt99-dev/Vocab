import type { ExplainRequest } from '@/shared/types/explain';

/**
 * Context lines shared by every unit prompt: the surrounding paragraph, source
 * page and detected language. Kept in one place so the word/phrase/sentence
 * prompts cannot drift apart.
 */
export function buildContextLines(request: ExplainRequest): string[] {
  const lines: string[] = [];
  if (request.context) lines.push(`It appeared in this context: "${request.context}"`);
  if (request.sourceTitle) lines.push(`Page title: "${request.sourceTitle}"`);
  if (request.sourceUrl) lines.push(`Source URL: ${request.sourceUrl}`);
  if (request.sourceLanguage) lines.push(`The source language is ${request.sourceLanguage}.`);
  return lines;
}

/**
 * System instruction for the "explain a word" capability. Kept separate from
 * any provider adapter so the prompt strategy can evolve without touching the
 * transport code.
 */
export const EXPLAIN_WORD_SYSTEM_PROMPT = [
  'You are a concise bilingual lexicographer helping a language learner.',
  'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
  'The JSON must match this shape exactly:',
  '{"meaning":string,"simpleExplanation":string,"translation":string,"partOfSpeech":string,',
  '"pronunciation":string,"examples":string[],"synonyms":string[],"antonyms":string[],',
  '"relatedWords":string[],"collocations":string[],"grammar":string}',
  'Rules: meaning is one precise sentence; simpleExplanation uses A2-level vocabulary;',
  'translation is the word translated into the requested language;',
  'partOfSpeech is the part of speech (noun, verb, adjective, …);',
  'pronunciation is IPA including slashes; examples has 2-3 natural sentences using the word;',
  'synonyms has up to 5 entries; antonyms has up to 5 opposites;',
  'relatedWords has up to 5 related terms (hypernyms, hyponyms, variants);',
  'collocations has up to 5 common word partners;',
  'grammar briefly notes countability and irregular forms.',
].join(' ');

/** Build the user turn for a word-explanation request. */
export function buildExplainWordUserPrompt(request: ExplainRequest): string {
  const { word, language = 'English' } = request;
  const lines = [`Word or phrase: "${word}"`];
  lines.push(...buildContextLines(request));
  lines.push(`Explain it in ${language}. Respond with JSON only.`);
  return lines.join('\n');
}
