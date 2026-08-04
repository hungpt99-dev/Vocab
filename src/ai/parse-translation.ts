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
 * Parse a word-alignment model response into one ordered pair-list PER paragraph.
 * The model answers with `{"paragraphs":[{"pairs":[{"source","target"}]}]}` but
 * may wrap it in prose/fences; we extract the object and coerce the array.
 *
 * To stay robust when the model returns a single flat `{"pairs":[...]}` (older
 * shape) or fewer entries than paragraphs, we round-robin the available pair
 * lists across paragraphs instead of throwing — better to show imperfect glosses
 * than to drop the whole feature. A malformed reply yields empty lists.
 */
export function parseWordAlignments(raw: string, paragraphCount: number): WordPair[][] {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;

  // Preferred shape: one pair-list per paragraph.
  if (Array.isArray(parsed.paragraphs)) {
    const lists: WordPair[][] = [];
    for (const entry of parsed.paragraphs) {
      if (!entry || typeof entry !== 'object') continue;
      const pairs = (entry as Record<string, unknown>).pairs;
      if (!Array.isArray(pairs)) continue;
      const list = toPairs(pairs as unknown[]);
      if (list.length > 0) lists.push(list);
    }
    if (lists.length > 0) return distribute(lists, paragraphCount);
  }

  // Legacy shape: a single flat pair list for the whole batch.
  if (Array.isArray(parsed.pairs)) {
    const single = toPairs(parsed.pairs as unknown[]);
    if (single.length > 0) return distribute([single], paragraphCount);
  }

  return Array.from({ length: paragraphCount }, () => []);
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

/** Spread the parsed pair-lists across `count` paragraphs, repeating if needed. */
function distribute(lists: WordPair[][], count: number): WordPair[][] {
  if (lists.length >= count) return lists.slice(0, count);
  const out: WordPair[][] = [];
  for (let i = 0; i < count; i += 1) {
    const list = lists[i % lists.length];
    if (list) out.push(list);
  }
  return out;
}


