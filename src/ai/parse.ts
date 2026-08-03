import type { Explanation } from '@/shared/types/vocabulary';
import { AiError } from './types';

/** Pull a JSON object out of a model response that may be fenced or padded. */
export function extractJsonObject(raw: string): unknown {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new AiError('bad_response', 'The AI response did not contain a JSON object.');
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AiError('bad_response', 'The AI response was not valid JSON.');
  }
}

/**
 * Extract the translated text from a model response that may be wrapped in
 * markdown fences. Placeholders (`[[n]]`) inside it are passed through intact.
 */
export function extractTranslation(raw: string): string {
  const text = raw.trim();
  const fenced = text.match(/```(?:[a-z0-9_-]*)?\s*([\s\S]*?)```/i);
  const translation = (fenced?.[1] ?? text).trim();
  if (!translation) {
    throw new AiError('bad_response', 'The AI response was empty.');
  }
  return translation;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean);
  }
  const single = asString(value);
  return single ? [single] : [];
}

/** Coerce an arbitrary model response into a well-formed Explanation. */
export function toExplanation(
  raw: string,
  meta: { provider: string; model: string },
): Explanation {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;
  const meaning = asString(parsed.meaning);
  if (!meaning) {
    throw new AiError('bad_response', 'The AI response was missing a meaning.');
  }

  return {
    meaning,
    simpleExplanation: asString(parsed.simpleExplanation) || meaning,
    translation: asString(parsed.translation),
    examples: asStringArray(parsed.examples),
    synonyms: asStringArray(parsed.synonyms),
    antonyms: asStringArray(parsed.antonyms),
    relatedWords: asStringArray(parsed.relatedWords),
    pronunciation: asString(parsed.pronunciation),
    collocations: asStringArray(parsed.collocations),
    grammar: asString(parsed.grammar),
    partOfSpeech: asString(parsed.partOfSpeech),
    usage: asString(parsed.usage),
    summary: asString(parsed.summary),
    difficultVocabulary: asStringArray(parsed.difficultVocabulary),
    register: asString(parsed.register),
    etymology: asString(parsed.etymology),
    relatedPhrases: asStringArray(parsed.relatedPhrases),
    provider: meta.provider,
    model: meta.model,
    generatedAt: Date.now(),
  };
}
