import type {
  XRayCefrLevel,
  XRayComplexityLayer,
  XRayDifficulty,
  XRayReadingResult,
  XRayRelationship,
  XRayVocabularyItem,
} from '@/shared/types/xray';
import { XRAY_CEFR_LEVELS } from '@/shared/types/xray';
import { extractJsonObject } from './parse';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> =>
    typeof item === 'object' && item !== null && !Array.isArray(item),
  );
}

/** Keep only the layers that carry real information. */
function toComplexity(value: unknown): XRayComplexityLayer[] {
  const layers: XRayComplexityLayer[] = [];
  for (const raw of asRecordArray(value)) {
    const text = asString(raw.text);
    const explanation = asString(raw.explanation);
    if (!text && !explanation) continue;
    const relatesTo = asString(raw.relatesTo);
    layers.push({ text, explanation, ...(relatesTo ? { relatesTo } : {}) });
  }
  return layers;
}

function toRelationships(value: unknown): XRayRelationship[] {
  const links: XRayRelationship[] = [];
  for (const raw of asRecordArray(value)) {
    const from = asString(raw.from);
    const to = asString(raw.to);
    if (!from || !to) continue;
    links.push({ from, relation: asString(raw.relation), to });
  }
  return links;
}

/** Up to 5 vocabulary items that carry both a term and a note. */
function toVocabulary(value: unknown): XRayVocabularyItem[] {
  const items: XRayVocabularyItem[] = [];
  for (const raw of asRecordArray(value)) {
    const term = asString(raw.term);
    const note = asString(raw.note);
    if (!term || !note) continue;
    const kind = asString(raw.kind);
    items.push({ term, note, ...(kind ? { kind } : {}) });
  }
  return items.slice(0, 5);
}

/**
 * Normalise the CEFR level. Models write it as "b2", "B2 (upper-intermediate)"
 * or "Level B2"; anything that does not yield one of the six levels is dropped
 * rather than guessed. CEFR here is only a rough difficulty scale and carries
 * no claim about which language the text is in.
 */
function toDifficulty(value: unknown): XRayDifficulty | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const match = /\b([abc][12])\b/i.exec(asString(raw.cefr));
  if (!match) return undefined;
  const cefr = match[1]!.toUpperCase() as XRayCefrLevel;
  if (!XRAY_CEFR_LEVELS.includes(cefr)) return undefined;
  const reason = asString(raw.reason);
  return { cefr, ...(reason ? { reason } : {}) };
}

/**
 * Coerce a model response into an XRayReadingResult, or return null when the
 * response carries no usable X-Ray payload (so callers can fall back to the
 * plain explanation instead of showing an empty panel).
 *
 * Tolerant by design: models occasionally flatten `core` or omit optional
 * arrays, and no field is language-specific.
 */
export function toXRayResult(raw: string, originalText: string): XRayReadingResult | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  return xrayFromObject(parsed, originalText);
}

/** Build an X-Ray result from an already-parsed object. */
export function xrayFromObject(
  parsed: Record<string, unknown>,
  originalText: string,
): XRayReadingResult | null {
  const coreRaw =
    typeof parsed.core === 'object' && parsed.core !== null
      ? (parsed.core as Record<string, unknown>)
      : {};

  // Accept both the nested `core` shape and a flattened variant.
  const representation = asString(coreRaw.representation) || asString(parsed.representation);
  const coreMeaning = asString(coreRaw.simpleMeaning) || asString(parsed.simpleMeaning);
  const fullExplanation = asString(parsed.fullExplanation);
  const complexity = toComplexity(parsed.complexity);
  const relationships = toRelationships(parsed.relationships);

  // Whole-sentence anatomy (VOC-122). Every one of these is optional, so a
  // sparse response degrades to the VOC-121 view instead of rendering blanks.
  const structure = asString(parsed.structure);
  const grammar = asString(parsed.grammar);
  const why = asString(parsed.why);
  const vocabulary = toVocabulary(parsed.vocabulary);
  const difficulty = toDifficulty(parsed.difficulty);
  const simplerVersion = asString(parsed.simplerVersion);

  // A generic explanation response (just `meaning`) is NOT an X-Ray: require at
  // least one X-Ray-specific signal, otherwise the caller should fall back to
  // the plain explanation rather than render an empty panel.
  if (
    !representation &&
    !coreMeaning &&
    !fullExplanation &&
    complexity.length === 0 &&
    !structure &&
    !grammar &&
    !why &&
    vocabulary.length === 0 &&
    !difficulty
  ) {
    return null;
  }

  // Only once we know this is an X-Ray may `meaning` stand in for the core.
  const simpleMeaning = coreMeaning || asString(parsed.meaning);
  // `meaning` doubles as the natural-meaning section; avoid repeating the core.
  const naturalMeaning = asString(parsed.meaning);

  return {
    detectedLanguage: asString(parsed.detectedLanguage),
    originalText: asString(parsed.originalText) || originalText,
    core: { representation, simpleMeaning },
    complexity,
    relationships,
    fullExplanation: fullExplanation || simpleMeaning,
    ...(structure ? { structure } : {}),
    ...(grammar ? { grammar } : {}),
    ...(naturalMeaning && naturalMeaning !== simpleMeaning ? { meaning: naturalMeaning } : {}),
    ...(why ? { why } : {}),
    ...(vocabulary.length > 0 ? { vocabulary } : {}),
    ...(difficulty ? { difficulty } : {}),
    // Only useful when it actually differs from the text it simplifies.
    ...(simplerVersion && simplerVersion !== originalText ? { simplerVersion } : {}),
  };
}
