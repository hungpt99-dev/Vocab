import type { ExplainKind } from '@/shared/types/ai';
import type { ExplainRequest } from '@/shared/types/explain';
import { XRAY_SYSTEM_PROMPT, buildXRayUserPrompt } from './xray.prompt';

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
 * transport code. Every kind returns the same JSON shape, so the parser never
 * branches on which analysis was requested.
 */
const JSON_SHAPE =
  '"meaning":string,"simpleExplanation":string,"translation":string,"partOfSpeech":string,' +
  '"pronunciation":string,"examples":string[],"synonyms":string[],"antonyms":string[],' +
  '"relatedWords":string[],"collocations":string[],"grammar":string,' +
  '"register":string,"etymology":string,"relatedPhrases":string[]';

export const EXPLAIN_WORD_SYSTEM_PROMPT = [
  'You are a concise bilingual lexicographer helping a language learner.',
  'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
  'The JSON must match this shape exactly:',
  `{${JSON_SHAPE}}`,
  'Rules: meaning is one precise sentence; simpleExplanation uses A2-level vocabulary;',
  'translation is the word translated into the requested language;',
  'partOfSpeech is the part of speech (noun, verb, adjective, …);',
  'pronunciation is IPA including slashes; examples has 2-3 natural sentences using the word;',
  'synonyms has up to 5 entries; antonyms has up to 5 opposites;',
  'relatedWords has up to 5 related terms (hypernyms, hyponyms, variants);',
  'collocations has up to 5 common word partners;',
  'grammar briefly notes countability and irregular forms;',
  'register notes whether the word is formal, informal or neutral and the typical context;',
  'etymology is a one-line origin of the word;',
  'relatedPhrases has up to 5 fixed expressions or collocations using the word.',
].join(' ');

function buildSystemPrompt(persona: string, rules: string): string {
  return [
    persona,
    'Always answer with a single JSON object and nothing else — no prose, no markdown fences.',
    `The JSON must match this shape exactly: {${JSON_SHAPE}}`,
    rules,
  ].join(' ');
}

const EXPLAIN_KIND_SYSTEM_PROMPTS: Record<ExplainKind, string> = {
  word: EXPLAIN_WORD_SYSTEM_PROMPT,
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
  examples: buildSystemPrompt(
    'You are a concise bilingual lexicographer helping a language learner see a word or phrase in use.',
    'Rules: examples has 5-6 natural, varied sentences using the word or phrase in different' +
      ' contexts; meaning is one precise sentence on what it means; simpleExplanation is an A2-level' +
      ' restatement; translation is the word or phrase translated into the requested language;' +
      ' synonyms, antonyms, relatedWords, collocations, pronunciation, grammar, register and' +
      ' etymology are empty.',
  ),
  native: buildSystemPrompt(
    'You are a bilingual teacher explaining a word or phrase to a learner in their own language.',
    'Rules: meaning is a clear definition written IN the requested language (the learner’s native' +
      ' tongue), not in English; simpleExplanation is the same idea in simpler words in that language;' +
      ' translation is the word or phrase translated into the requested language; examples has 2-3' +
      ' sentences that mix the requested language and the source language so the learner sees usage;' +
      ' synonyms, antonyms, relatedWords, collocations, pronunciation, grammar, register and' +
      ' etymology are empty.',
  ),
  // X-Ray Reading owns its full prompt (it does not return the lexicographer
  // JSON shape), so it is registered as-is rather than via buildSystemPrompt.
  xray: XRAY_SYSTEM_PROMPT,
  related: buildSystemPrompt(
    'You are a concise bilingual lexicographer expanding a learner’s vocabulary around one word.',
    'Rules: relatedWords lists up to 8 words or short phrases semantically related to the input' +
      ' (synonyms, antonyms, hypernyms, hyponyms, collocations, typical companions) — each a single' +
      ' term; relatedPhrases lists up to 4 fixed expressions or collocations using the input; meaning' +
      ' is one sentence on why these are related; simpleExplanation is an A2-level restatement;' +
      ' translation is the input word translated into the requested language; examples, synonyms,' +
      ' antonyms, pronunciation, collocations, grammar, register and etymology are empty.',
  ),
};

/** The original word-explanation system prompt, unchanged for compatibility. */
export const EXPLAIN_WORD_SYSTEM_PROMPT_KIND = EXPLAIN_KIND_SYSTEM_PROMPTS.word;

/** System prompt for a specific analysis kind. Defaults to the word prompt. */
export function buildExplainSystemPrompt(kind: ExplainKind = 'word', template?: string): string {
  // The user's custom template describes the word-explanation JSON shape, so it
  // must not hijack X-Ray Reading, which returns a different structure.
  if (kind !== 'xray' && template && template.trim()) {
    return substituteTemplate(template, kind);
  }
  return EXPLAIN_KIND_SYSTEM_PROMPTS[kind];
}

/**
 * Substitute editor tokens in a user-supplied system-prompt template.
 * Supported tokens: {{language}} {{word}} {{context}} {{kind}}.
 * Unknown tokens are left untouched; this is plain string interpolation
 * (never evaluated), so a user template cannot execute code.
 */
export function substituteTemplate(template: string, kind: ExplainKind = 'word', vars?: {
  language?: string;
  word?: string;
  context?: string;
}): string {
  const ctx = vars?.context ?? '';
  return template
    .replace(/\{\{\s*language\s*\}\}/g, vars?.language ?? 'English')
    .replace(/\{\{\s*word\s*\}\}/g, vars?.word ?? '')
    .replace(/\{\{\s*context\s*\}\}/g, ctx)
    .replace(/\{\{\s*kind\s*\}\}/g, kind);
}

/** Build the user turn for an explanation request, adapting to its kind. */
export function buildExplainWordUserPrompt({
  word,
  context,
  pageTitle,
  precedingText,
  sourceTitle,
  sourceUrl,
  sourceLanguage,
  language = 'English',
  kind = 'word',
}: ExplainRequest): string {
  if (kind === 'xray') {
    return buildXRayUserPrompt({
      word,
      context,
      pageTitle,
      precedingText,
      sourceTitle,
      sourceUrl,
      sourceLanguage,
      language,
      kind,
    });
  }
  const label = kind === 'word' ? 'Word or phrase' : 'Text';
  const lines = [`${label}: "${word}"`];
  if (context) lines.push(`It appeared in this context: "${context}"`);
  if (pageTitle) lines.push(`Page title: "${pageTitle}"`);
  if (precedingText) lines.push(`Preceding text on the page: "${precedingText}"`);
  // VOC-46-style context lines (sourceTitle/sourceUrl/sourceLanguage) are also
  // tolerated so the two prompt models can coexist.
  if (sourceTitle && !pageTitle) lines.push(`Page title: "${sourceTitle}"`);
  if (sourceUrl && !context) lines.push(`Source URL: ${sourceUrl}`);
  if (sourceLanguage) lines.push(`The source language is ${sourceLanguage}.`);
  lines.push(kind === 'word' ? `Explain it in ${language}.` : `Use ${language} for the explanation.`);
  lines.push('Respond with JSON only.');
  return lines.join('\n');
}
