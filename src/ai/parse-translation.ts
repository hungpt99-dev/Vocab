import { collapseWhitespace } from '@/shared/lib/text';
import { AiError } from './types';
import type { WordPair } from './types';
import { extractJsonObject } from './parse';

/**
 * Parse a model response into paragraph translations. The model answers with
 * `{"translations":[...]}` but may wrap it in prose or code fences; we extract
 * the object and coerce the array, then require the count to match the input so
 * a truncated reply surfaces as an error instead of misaligned columns.
 */
export function parseTranslations(raw: string, expected: number): string[] {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;
  const values = parsed.translations;
  if (!Array.isArray(values)) {
    throw new AiError('bad_response', 'The AI response did not contain a translations array.');
  }

  const translations = values.map((value) => collapseWhitespace(typeof value === 'string' ? value : ''));
  if (translations.length !== expected) {
    throw new AiError(
      'bad_response',
      `The AI returned ${translations.length} translations for ${expected} paragraphs.`,
    );
  }
  return translations;
}

/**
 * Parse a model response into an ordered list of word pairs. The model answers
 * with `{"pairs":[{"source","target"}]}` but may wrap it in prose/fences; we
 * extract the object and coerce the array. A truncated or malformed reply
 * yields an empty list so the caller can fall back to the full sentence.
 */
export function parseWordPairs(raw: string): WordPair[] {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;
  const values = parsed.pairs;
  if (!Array.isArray(values)) return [];
  const pairs: WordPair[] = [];
  for (const value of values) {
    if (typeof value !== 'object' || value === null) continue;
    const entry = value as Record<string, unknown>;
    const source = typeof entry.source === 'string' ? entry.source : '';
    const target = typeof entry.target === 'string' ? entry.target : '';
    if (!source && !target) continue;
    pairs.push({ source, target });
  }
  return pairs;
}

