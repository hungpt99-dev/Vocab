import type { ExplainRequest, ExplainUnit } from '@/shared/types/explain';
import {
  EXPLAIN_WORD_SYSTEM_PROMPT,
  buildContextLines,
  buildExplainWordUserPrompt,
} from './explain-word.prompt';

export const EXPLAIN_PHRASE_SYSTEM_PROMPT = [
  'You are a concise bilingual language coach explaining a phrase to a learner.',
  'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
  'The JSON must match this shape exactly:',
  '{"meaning":string,"translation":string,"grammar":string,"usage":string,"examples":string[]}',
  'Rules: meaning explains what the phrase means as a whole, not word by word;',
  'translation renders the phrase into the requested language;',
  'grammar notes the structure (idiom, verb + gerund, prepositional phrase, …);',
  'usage explains the register and typical contexts it appears in;',
  'examples has 2-3 natural sentences using the phrase.',
].join(' ');

export const EXPLAIN_SENTENCE_SYSTEM_PROMPT = [
  'You are a concise bilingual tutor helping a language learner understand a sentence.',
  'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
  'The JSON must match this shape exactly:',
  '{"meaning":string,"translation":string,"grammar":string,"summary":string,',
  '"difficultVocabulary":string[]}',
  'Rules: meaning is a brief gist of the sentence;',
  'translation renders the whole sentence into the requested language;',
  'grammar notes the notable grammar (tense, clauses, word order);',
  'summary is a plain-language explanation of what the sentence communicates;',
  'difficultVocabulary lists words a B1 learner may not know, each as "word: short gloss".',
].join(' ');

/** System instruction matching the requested selection unit. */
export function buildExplainSystemPrompt(unit?: ExplainUnit): string {
  switch (unit) {
    case 'phrase':
      return EXPLAIN_PHRASE_SYSTEM_PROMPT;
    case 'sentence':
      return EXPLAIN_SENTENCE_SYSTEM_PROMPT;
    default:
      return EXPLAIN_WORD_SYSTEM_PROMPT;
  }
}

export function buildExplainPhraseUserPrompt(request: ExplainRequest): string {
  const { word, language = 'English' } = request;
  const lines = [`Phrase: "${word}"`];
  lines.push(...buildContextLines(request));
  lines.push(`Explain this phrase in ${language}. Respond with JSON only.`);
  return lines.join('\n');
}

export function buildExplainSentenceUserPrompt(request: ExplainRequest): string {
  const { word, language = 'English' } = request;
  const lines = [`Sentence: "${word}"`];
  lines.push(...buildContextLines(request));
  lines.push(`Explain this sentence in ${language}. Respond with JSON only.`);
  return lines.join('\n');
}

/** User turn for the requested selection unit; defaults to a word. */
export function buildExplainUserPrompt(request: ExplainRequest): string {
  switch (request.unit) {
    case 'phrase':
      return buildExplainPhraseUserPrompt(request);
    case 'sentence':
      return buildExplainSentenceUserPrompt(request);
    default:
      return buildExplainWordUserPrompt(request);
  }
}
