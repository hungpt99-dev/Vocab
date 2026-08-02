import type { ExplainRequest } from './types';

export const SYSTEM_PROMPT = [
  'You are a concise bilingual lexicographer helping a language learner.',
  'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
  'The JSON must match this shape exactly:',
  '{"meaning":string,"simpleExplanation":string,"examples":string[],"synonyms":string[],',
  '"pronunciation":string,"collocations":string[]}',
  'Rules: meaning is one precise sentence; simpleExplanation uses A2-level vocabulary;',
  'examples has 2-3 natural sentences using the word; synonyms has up to 5 entries;',
  'pronunciation is IPA including slashes; collocations has up to 5 common word partners.',
].join(' ');

export function buildUserPrompt({ word, context, language = 'English' }: ExplainRequest): string {
  const lines = [`Word or phrase: "${word}"`];
  if (context) lines.push(`It appeared in this sentence: "${context}"`);
  lines.push(`Explain it in ${language}. Respond with JSON only.`);
  return lines.join('\n');
}
