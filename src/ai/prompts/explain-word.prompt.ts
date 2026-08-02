import type { ExplainKind } from '@/shared/types/ai';
import type { ExplainRequest } from '../types';

/**
 * System instruction for the "explain a word" capability. Kept separate from
 * any provider adapter so the prompt strategy can evolve without touching the
 * transport code. Every kind returns the same JSON shape, so the parser never
 * branches on which analysis was requested.
 */
const JSON_SHAPE =
  '"meaning":string,"simpleExplanation":string,"translation":string,"examples":string[],' +
  '"synonyms":string[],"antonyms":string[],"relatedWords":string[],"pronunciation":string,' +
  '"collocations":string[],"grammar":string';

function buildSystemPrompt(persona: string, rules: string): string {
  return [
    persona,
    'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
    `The JSON must match this shape exactly: {${JSON_SHAPE}}`,
    rules,
  ].join(' ');
}

const EXPLAIN_KIND_SYSTEM_PROMPTS: Record<ExplainKind, string> = {
  word: buildSystemPrompt(
    'You are a concise bilingual lexicographer helping a language learner.',
    'Rules: meaning is one precise sentence; simpleExplanation uses A2-level vocabulary;' +
      ' translation is the word translated into the requested language; examples has 2-3 natural' +
      ' sentences using the word; synonyms has up to 5 entries; antonyms has up to 5 opposites;' +
      ' relatedWords has up to 5 related terms (hypernyms, hyponyms, variants);' +
      ' pronunciation is IPA including slashes; collocations has up to 5 common word partners;' +
      ' grammar briefly notes part of speech, countability and irregular forms.',
  ),
  sentence: buildSystemPrompt(
    'You are a concise bilingual English teacher helping a language learner understand a whole sentence.',
    'Rules: meaning is one clear sentence stating what the text means; simpleExplanation restates' +
      ' the same idea in A2-level words; grammar notes the key grammatical structures used;' +
      ' translation is the whole text translated into the requested language; pronunciation is an' +
      ' empty string; examples has 1-2 short uses; synonyms, antonyms, relatedWords and' +
      ' collocations are empty arrays.',
  ),
  grammar: buildSystemPrompt(
    'You are a concise grammarian analysing a sentence for a language learner.',
    'Rules: grammar is the detailed analysis — part of speech roles, tense and aspect, clause' +
      ' structure and any notable constructions; meaning is one line on what the sentence says;' +
      ' simpleExplanation is an A2-level paraphrase; translation is the text translated into the' +
      ' requested language; examples, synonyms, antonyms, relatedWords, pronunciation and' +
      ' collocations are empty.',
  ),
  vocabulary: buildSystemPrompt(
    'You are a concise bilingual lexicographer helping a language learner pick out the hard words in a sentence.',
    'Rules: relatedWords lists the up-to-6 words or short phrases in the text a learner is most' +
      ' likely to find difficult, each written as "term: brief meaning"; meaning is one sentence' +
      ' summarising what the text says; simpleExplanation is an A2-level paraphrase of the text;' +
      ' translation is the text translated into the requested language; examples, synonyms,' +
      ' antonyms, pronunciation and collocations are empty; grammar is empty.',
  ),
  simplify: buildSystemPrompt(
    'You are a concise writer who rewrites English into plain, A2-level language for a learner.',
    'Rules: simpleExplanation is the text rewritten in simpler English, keeping every idea;' +
      ' meaning is the original text restated in one clear sentence; translation is the simplified' +
      ' version translated into the requested language; examples, synonyms, antonyms, relatedWords,' +
      ' pronunciation, collocations and grammar are empty.',
  ),
  summarize: buildSystemPrompt(
    'You are a concise summariser distilling English text for a language learner.',
    'Rules: meaning is the summary — one sentence for a single sentence, up to three for a' +
      ' paragraph — keeping the key points; simpleExplanation is a one-line version of that summary;' +
      ' translation is the summary translated into the requested language; examples, synonyms,' +
      ' antonyms, relatedWords, pronunciation, collocations and grammar are empty.',
  ),
};

/** The original word-explanation system prompt, unchanged for compatibility. */
export const EXPLAIN_WORD_SYSTEM_PROMPT = EXPLAIN_KIND_SYSTEM_PROMPTS.word;

/** System prompt for a specific analysis kind. Defaults to the word prompt. */
export function buildExplainSystemPrompt(kind: ExplainKind = 'word'): string {
  return EXPLAIN_KIND_SYSTEM_PROMPTS[kind];
}

/** Build the user turn for an explanation request, adapting to its kind. */
export function buildExplainWordUserPrompt({
  word,
  context,
  language = 'English',
  kind = 'word',
}: ExplainRequest): string {
  const label = kind === 'word' ? 'Word or phrase' : 'Text';
  const lines = [`${label}: "${word}"`];
  if (context) lines.push(`It appeared in this context: "${context}"`);
  lines.push(kind === 'word' ? `Explain it in ${language}.` : `Use ${language} for the explanation.`);
  lines.push('Respond with JSON only.');
  return lines.join('\n');
}
