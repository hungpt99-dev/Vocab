import { collapseWhitespace } from '@/shared/lib/text';
import { AiError } from './types';
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
