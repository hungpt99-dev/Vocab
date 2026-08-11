import type { Settings, SavedProvider } from '@/shared/types/settings';
import type { RankedCandidate, RadarCandidate } from './types';
import {
  RADAR_SYSTEM_PROMPT_V1,
  buildRadarUserPrompt,
} from '@/ai/prompts/radar.prompt';
import { runWithFallback } from '@/ai/pipeline';
import { getProvider } from '@/ai/registry';
import { AiError } from '@/ai/types';
import { chunkText, DEFAULT_MAX_CHUNK_CHARS, DEFAULT_CHUNK_OVERLAP_CHARS, type ChunkOptions } from './chunk';
import { parseRadarAnalysis } from './validate';
import { mergeAndRank, MIN_DISPLAY_SCORE } from './rank';
import { RadarAnalysisCache } from './cache';

export interface AnalyzePageParams {
  /** The user's free-text learning goal (the source of truth for what to find). */
  goal: string;
  /** Cleaned page text (already extracted by the caller). */
  pageText: string;
  /** Normalised page URL, used as part of the cache key. */
  pageUrl: string;
  /** Max candidates to return (Top N). Default 5. */
  limit?: number;
  /** Chunking options. */
  chunkOptions?: ChunkOptions;
  /** Abort signal so the user can cancel an in-flight analysis. */
  signal?: AbortSignal;
  /** Progress callback: (completedChunks, totalChunks). */
  onProgress?: (done: number, total: number) => void;
}

export interface AnalyzePageResult {
  candidates: RankedCandidate[];
  /** How many chunks were analyzed successfully (for partial-failure UX). */
  chunksAnalyzed: number;
  /** Total chunks attempted. */
  chunksTotal: number;
  /** True when at least one chunk failed but we still returned results. */
  partial: boolean;
}

/**
 * Application-level entry point for Vocabulary Radar. Mirrors ExplainService:
 * it never touches a provider SDK directly — it resolves the configured active
 * provider through the shared `runWithFallback` pipeline (BYOK, rate limit,
 * retry, fallback) and calls the provider-agnostic `complete()` capability.
 *
 * Responsibilities, split for testability:
 *  - chunk the page text (chunk.ts)
 *  - ask the AI per chunk, validating the response (validate.ts)
 *  - merge + rank + dedupe + cap (rank.ts)
 *  - cache by URL + goal + content hash (cache.ts)
 */
export class RadarVocabularyService {
  private readonly cache = new RadarAnalysisCache();

  async analyzePage(
    settings: Settings,
    params: AnalyzePageParams,
  ): Promise<AnalyzePageResult> {
    const { goal, pageText, pageUrl, limit = 5, chunkOptions, signal, onProgress } = params;

    const trimmed = pageText.trim();
    if (!trimmed) {
      return { candidates: [], chunksAnalyzed: 0, chunksTotal: 0, partial: false };
    }

    // Cache hit: same URL + same goal + same content → reuse.
    const cached = this.cache.get(pageUrl, goal, trimmed);
    if (cached) {
      onProgress?.(1, 1);
      return {
        candidates: mergeAndRank(cached, limit),
        chunksAnalyzed: 1,
        chunksTotal: 1,
        partial: false,
      };
    }

    const chunks = chunkText(trimmed, {
      maxChars: DEFAULT_MAX_CHUNK_CHARS,
      overlapChars: DEFAULT_CHUNK_OVERLAP_CHARS,
      ...chunkOptions,
    });
    if (chunks.length === 0) {
      return { candidates: [], chunksAnalyzed: 0, chunksTotal: 0, partial: false };
    }

    const collected: RadarCandidate[] = [];
    let analyzed = 0;
    let failed = false;

    for (let i = 0; i < chunks.length; i++) {
      signal?.throwIfAborted();
      try {
        const chunkCandidates = await this.analyzeChunk(settings, goal, chunks[i]!, signal);
        collected.push(...chunkCandidates);
      } catch (error) {
        const code = error instanceof AiError ? error.code : 'unknown';
        if (code === 'aborted') throw error;
        // Hard, non-transient AI errors (bad key, bad response, no provider)
        // must surface to the user rather than be disguised as "no vocabulary".
        if (
          code === 'missing_api_key' ||
          code === 'unauthorized' ||
          code === 'bad_response' ||
          code === 'config' ||
          code === 'unknown_provider'
        ) {
          throw error;
        }
        // Transient failures (rate limit, network) are tolerated per-chunk so a
        // single flaky request doesn't sink the whole page.
        failed = true;
      }
      analyzed = i + 1;
      onProgress?.(analyzed, chunks.length);
    }

    const ranked = mergeAndRank(collected, limit);
    if (!failed && analyzed === chunks.length) {
      this.cache.set(pageUrl, goal, trimmed, collected);
    }

    return {
      candidates: ranked,
      chunksAnalyzed: analyzed,
      chunksTotal: chunks.length,
      partial: failed && ranked.length > 0,
    };
  }

  /** Analyze a single chunk: run the AI and validate/coerce candidates. */
  private async analyzeChunk(
    settings: Settings,
    goal: string,
    chunk: string,
    signal?: AbortSignal,
  ): Promise<RadarCandidate[]> {
    const { value } = await runWithFallback<string>(
      settings,
      (_provider: SavedProvider, sig?: AbortSignal) =>
        getProvider(_provider.type).complete(
          RADAR_SYSTEM_PROMPT_V1,
          buildRadarUserPrompt({ goal, text: chunk }),
          { ...providerConfig(_provider), signal: sig ?? signal },
        ),
      signal,
    );
    if (!value || !value.trim()) {
      throw new AiError('bad_response', 'The AI returned an empty response.');
    }
    return parseRadarAnalysis(value, chunk);
  }

  /** Exposed for tests: validate + rank a set of raw candidates from text. */
  rankFromText(rawResponse: string, sourceText: string, limit = 5): RankedCandidate[] {
    const candidates = parseRadarAnalysis(rawResponse, sourceText);
    return mergeAndRank(candidates, limit);
  }

  /** Clear cached analyses (e.g. on goal change). */
  clearCache(): void {
    this.cache.clear?.();
  }
}

/** Build a ProviderConfig from a saved provider for the chat-completion call. */
function providerConfig(provider: SavedProvider) {
  return {
    apiKey: provider.apiKey,
    model: provider.model,
    baseUrl: provider.baseUrl,
    temperature: provider.temperature,
    maxTokens: provider.maxTokens ?? 1024,
    timeoutMs: provider.timeoutMs,
  };
}

export const radarVocabularyService = new RadarVocabularyService();
export { MIN_DISPLAY_SCORE };
