import type { RadarCandidate } from './types';
import { extractJsonObject } from '@/ai/parse';
import { AiError } from '@/ai/types';
import { collapseWhitespace } from '@/shared/lib/text';

/** Strip wrapping quotes and surrounding punctuation a model may add. */
function stripQuotes(value: string): string {
  return value
    .trim()
    .replace(/^[""''`“”‘’]+/, '')
    .replace(/[""''`“”‘’]+$/, '')
    .trim();
}

/** Build a case-insensitive "appears in text" tester that tolerates light
 * whitespace/normalisation differences and wrapping quotes/punctuation. Returns
 * true when `needle` is present as a substring of `haystack` (also tested
 * ignoring case and collapsing runs of whitespace, since models sometimes alter
 * spacing or wrap phrases in quotes). */
export function makeTextContains(haystack: string): (needle: string) => boolean {
  const base = haystack.toLowerCase();
  const collapsed = collapseWhitespace(haystack).toLowerCase();
  return (needle: string): boolean => {
    const n = stripQuotes(needle);
    if (!n) return false;
    const nl = n.toLowerCase();
    if (base.includes(nl)) return true;
    const nc = collapseWhitespace(n).toLowerCase();
    if (collapsed.includes(nc)) return true;
    // Last resort: drop a leading article/determiner ("a/the") some models add.
    const deArticle = nl.replace(/^(a|an|the)\s+/, '');
    if (deArticle !== nl && (base.includes(deArticle) || collapsed.includes(collapseWhitespace(deArticle)))) {
      return true;
    }
    return false;
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  }
  return null;
}

/**
 * Validate and coerce one raw candidate object into a GoalCandidate.
 * Returns null when the candidate must be rejected (missing text, not present
 * in the source text, invalid type, or score out of range). Never throws for a
 * single bad candidate — the caller decides how strict to be.
 */
export function validateCandidate(
  raw: unknown,
  contains: (needle: string) => boolean,
): RadarCandidate | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const text = stripQuotes(asString(obj.text));
  if (!text) return null;
  if (!contains(text)) return null;

  const type = obj.type === 'phrase' ? 'phrase' : 'word';
  const score = normalizeScore(obj.score);
  if (score === null) return null;

  return {
    text,
    type,
    score,
    reason: asString(obj.reason),
    context: asString(obj.context) || undefined,
  };
}

/**
 * Parse and validate a full AI response. Robust to:
 * - invalid JSON (throws AiError 'bad_response')
 * - malformed/missing `candidates`
 * - missing fields, out-of-range scores, items not in the text
 * Candidates not passing validation are dropped rather than failing the whole
 * analysis (partial quality over total failure).
 */
export function parseRadarAnalysis(
  raw: string,
  sourceText: string,
): RadarCandidate[] {
  let parsed: unknown;
  try {
    parsed = extractJsonObject(raw);
  } catch {
    throw new AiError('bad_response', 'The AI response was not valid JSON.');
  }

  const obj = parsed as Record<string, unknown>;
  const list = obj?.candidates;
  if (!Array.isArray(list)) {
    throw new AiError('bad_response', 'The AI response was missing a candidates array.');
  }

  const contains = makeTextContains(sourceText);
  const candidates: RadarCandidate[] = [];
  for (const item of list) {
    const valid = validateCandidate(item, contains);
    if (valid) candidates.push(valid);
  }
  return candidates;
}
