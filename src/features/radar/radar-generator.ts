import type { Settings } from '@/shared/types/settings';
import type { RadarCandidateInput, RadarRelationship } from './types';
import {
  RADAR_GENERATE_SYSTEM_PROMPT,
  buildRadarGenerateUserPrompt,
} from '@/ai/prompts/radar-generate.prompt';
import { runAiCall } from '@/ai/pipeline';
import { AiError } from '@/ai/types';
import { extractJsonObject } from '@/ai/parse';

export interface GenerateRadarParams {
  /** The saved word to generate related vocabulary for. */
  word: string;
  /** Part of speech of the saved word, when known. */
  partOfSpeech?: string;
  /** Meaning of the saved word, when known. */
  meaning?: string;
  /** Related terms the learner already knows (avoid re-proposing them). */
  existingRelated?: string[];
  /** Abort signal so the caller can cancel. */
  signal?: AbortSignal;
}

export interface RadarGenerationResult {
  candidates: RadarCandidateInput[];
}

const RELATIONSHIPS: ReadonlySet<string> = new Set<RadarRelationship>([
  'synonym',
  'antonym',
  'hyponym',
  'hypernym',
  'collocation',
  'phrase',
  'form',
  'related',
]);

/**
 * Generates Radar candidates FROM a saved word. This is the single AI entry point
 * for Radar: it does NOT scan pages and does NOT take an arbitrary search query.
 * It mirrors the ExplainService pattern — it resolves the configured active
 * provider through `runWithFallback` (BYOK, retry, fallback) and calls the
 * provider-agnostic `complete()` capability.
 */
export class RadarGeneratorService {
  async generate(
    settings: Settings,
    params: GenerateRadarParams,
  ): Promise<RadarGenerationResult> {
    const { word } = params;
    if (!word.trim()) return { candidates: [] };

    const active = settings.providers.find((p) => p.id === settings.activeProviderId);
    if (!active) {
      throw new AiError('unknown_provider', 'No active AI provider is configured.');
    }

    const userPrompt = buildRadarGenerateUserPrompt({
      word,
      partOfSpeech: params.partOfSpeech,
      meaning: params.meaning,
      existingRelated: params.existingRelated,
    });

    // Route through runAiCall so Radar generation shares the SAME rate limiter as
    // explain/translate (5 req / 10s). Previously this called runWithFallback
    // directly and was UNRATE-LIMITED, so enriching many words (or
    // radar:generate-all over a large library) fired unbounded concurrent AI
    // requests and pinned the service worker at ~100% CPU.
    const value = await runAiCall<string>(
      active,
      (adapter, config) => adapter.complete(RADAR_GENERATE_SYSTEM_PROMPT, userPrompt, config),
      params.signal,
    );

    if (!value || !value.trim()) {
      throw new AiError('bad_response', 'The AI returned an empty response.');
    }

    return { candidates: parseCandidates(value) };
  }
}

/** Parse + coerce the model JSON into a bounded, validated candidate list. */
function parseCandidates(raw: string): RadarCandidateInput[] {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;
  const rawCandidates = parsed.candidates;
  if (!Array.isArray(rawCandidates)) return [];

  const out: RadarCandidateInput[] = [];
  for (const item of rawCandidates) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    const w = typeof obj.word === 'string' ? obj.word.trim() : '';
    if (!w) continue;
    const rel = typeof obj.relationship === 'string' && RELATIONSHIPS.has(obj.relationship)
      ? (obj.relationship as RadarRelationship)
      : 'related';
    const reason = typeof obj.reason === 'string' ? obj.reason.trim() : '';
    out.push({ word: w, relationship: rel, reason });
  }
  // Bound the list so a verbose model cannot blow up the Radar store.
  return out.slice(0, 20);
}

export const radarGeneratorService = new RadarGeneratorService();
