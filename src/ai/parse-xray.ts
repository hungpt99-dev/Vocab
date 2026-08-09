import type {
  XRayComplexityLayer,
  XRayReadingResult,
  XRayRelationship,
} from '@/shared/types/xray';
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

  // A generic explanation response (just `meaning`) is NOT an X-Ray: require at
  // least one X-Ray-specific signal, otherwise the caller should fall back to
  // the plain explanation rather than render an empty panel.
  if (!representation && !coreMeaning && !fullExplanation && complexity.length === 0) {
    return null;
  }

  // Only once we know this is an X-Ray may `meaning` stand in for the core.
  const simpleMeaning = coreMeaning || asString(parsed.meaning);

  return {
    detectedLanguage: asString(parsed.detectedLanguage),
    originalText: asString(parsed.originalText) || originalText,
    core: { representation, simpleMeaning },
    complexity,
    relationships,
    fullExplanation: fullExplanation || simpleMeaning,
  };
}
