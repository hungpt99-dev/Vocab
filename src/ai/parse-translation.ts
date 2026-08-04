import { collapseWhitespace } from '@/shared/lib/text';
import { AiError } from './types';
import type { WordPair } from './types';
import { extractJsonObject } from './parse';

/** A parsed alignment for one paragraph: a full-sentence translation plus word pairs. */
export interface ParsedAlign {
  translation: string;
  pairs: WordPair[];
}

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
 * Parse a word-alignment model response into one result PER paragraph: a
 * faithful full-sentence `translation` (in natural target word order — this is
 * what the page renders) plus an ordered `pairs` list for the hover gloss.
 *
 * The model answers with `{"paragraphs":[{"translation","pairs":[...]}]}` but may
 * wrap it in prose/fences; we extract the object and coerce the arrays.
 *
 * Robustness: if a paragraph entry lacks a `translation`, we fall back to joining
 * its pairs' targets; if the model returns the older flat `{"pairs":[...]}` shape
 * or fewer entries than paragraphs, we round-robin the available lists across
 * paragraphs. A malformed reply yields empty results.
 */
export function parseWordAlignments(raw: string, paragraphCount: number): ParsedAlign[] {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(raw) as Record<string, unknown>;
  } catch {
    // Malformed reply: yield empty results rather than throwing, so the caller
    // surfaces a single actionable error instead of a raw parse exception.
    return Array.from({ length: paragraphCount }, () => ({ translation: '', pairs: [] }));
  }

  // Preferred shape: one result per paragraph.
  if (Array.isArray(parsed.paragraphs)) {
    const results: ParsedAlign[] = [];
    for (const entry of parsed.paragraphs) {
      if (!entry || typeof entry !== 'object') continue;
      const node = entry as Record<string, unknown>;
      const pairs = Array.isArray(node.pairs) ? toPairs(node.pairs as unknown[]) : [];
      const translation =
        typeof node.translation === 'string' && node.translation.trim()
          ? collapseWhitespace(node.translation)
          : pairs.map((pair) => pair.target).join(' ').trim();
      if (translation || pairs.length > 0) {
        results.push({ translation, pairs });
      }
    }
    if (results.length > 0) return distribute(results, paragraphCount);
  }

  // Legacy shape: a single flat pair list for the whole batch.
  if (Array.isArray(parsed.pairs)) {
    const pairs = toPairs(parsed.pairs as unknown[]);
    if (pairs.length > 0) {
      const translation = pairs.map((pair) => pair.target).join(' ').trim();
      return distribute([{ translation, pairs }], paragraphCount);
    }
  }

  return Array.from({ length: paragraphCount }, () => ({ translation: '', pairs: [] }));
}

function toPairs(values: unknown[]): WordPair[] {
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

/** Spread the parsed results across `count` paragraphs, repeating if needed. */
function distribute(results: ParsedAlign[], count: number): ParsedAlign[] {
  if (results.length >= count) return results.slice(0, count);
  const out: ParsedAlign[] = [];
  for (let i = 0; i < count; i += 1) {
    const result = results[i % results.length];
    if (result) out.push(result);
  }
  return out;
}


