import type { ExplainKind } from '@/shared/types/ai';
import type { Explanation } from '@/shared/types/vocabulary';
import type { AiProviderId } from '@/shared/types/settings';

export interface ExplainRequest {
  word: string;
  /** Sentence the word appeared in, used to disambiguate the sense. */
  context?: string;
  /** Page title where the word was encountered, for topical context. */
  pageTitle?: string;
  /** Short excerpt of text preceding the word on the page, for topical context. */
  precedingText?: string;
  /** Target language for the explanation. */
  language?: string;
  /** Optional user-editable system-prompt template (tokens: {{language}} {{word}} {{context}} {{kind}}). */
  promptTemplate?: string;
  /** Which analysis to produce. Defaults to 'word'. */
  kind?: ExplainKind;
}

export interface TranslateRequest {
  /** Paragraphs to translate, in order. */
  paragraphs: TranslationParagraphLike[];
  /** Target language name, e.g. "Russian". */
  language: string;
}

/** A paragraph to translate, with an optional caller-owned id for alignment. */
export interface TranslationParagraphLike {
  id?: string;
  text: string;
}

/** A paragraph the caller wants translated, with a stable caller-owned id. */
export interface TranslationParagraph {
  id: string;
  text: string;
}

/** A translated paragraph, keyed by the caller's paragraph id. */
export interface TranslationResult {
  id: string;
  text: string;
  translation: string;
  /** Optional timing breakdown, attached for bilingual debug logging. */
  perf?: BilingualPerf;
}

/** A single source→target word alignment produced by the word-align mode. */
export interface WordPair {
  source: string;
  target: string;
}

/** A paragraph translated with an optional word-by-word alignment. */
export interface WordAlignResult {
  id: string;
  text: string;
  /** Ordered source→target glosses, one per token. Empty when unavailable. */
  pairs: WordPair[];
  /** Full-sentence translation, used as a fallback when pairs are missing. */
  translation: string;
  /** Optional timing breakdown, attached for bilingual debug logging. */
  perf?: BilingualPerf;
}

/** Per-request timing breakdown for the bilingual pipeline (debug only). */
export interface BilingualPerf {
  /** Wall-clock service-worker time for the whole request, ms. */
  totalMs: number;
  /** Time spent waiting on the rate limiter queue, ms. */
  rateLimitWaitMs: number;
  /** Time spent in the provider call(s), ms. */
  providerMs: number;
  /** Number of chunks the paragraphs were split into. */
  chunks: number;
  /** Number of chunks served from the in-memory cache. */
  cacheHits: number;
}

export type TranslateResultList = TranslationResult[];

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  /** Sampling temperature (0–1). Provider falls back to its own default. */
  temperature?: number;
  /** Max tokens to generate. Provider falls back to its own default. */
  maxTokens?: number;
  /** Abort signal so callers can cancel in-flight requests. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface AiProvider {
  readonly id: AiProviderId;
  readonly label: string;
  readonly defaultModel: string;
  readonly defaultBaseUrl: string;
  /** Whether this provider requires an API key (local runtimes do not). */
  readonly requiresApiKey: boolean;
  explain(request: ExplainRequest, config: ProviderConfig): Promise<Explanation>;
  translate(request: TranslateRequest, config: ProviderConfig): Promise<TranslateResult>;
  /** Word-by-word aligned translation: returns ordered source→target glosses. */
  align(request: TranslateRequest, config: ProviderConfig): Promise<WordAlignResult[]>;
  /**
   * Generic chat completion: run `system` + `user` turns and return the raw text.
   * Used by features (e.g. Vocabulary Goal Mode) that need a custom prompt while
   * still going through the provider's transport, auth and error handling.
   */
  complete(system: string, user: string, config: ProviderConfig): Promise<string>;
}

/** Provider-level translation response: one translation per input paragraph. */
export interface TranslateResult {
  paragraphs: Array<{ text: string; translation: string }>;
}

export type AiErrorCode =
  | 'missing_api_key'
  | 'unauthorized'
  | 'rate_limited'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'bad_response'
  | 'unknown_provider'
  | 'server_error'
  | 'config';

/** Normalised error surface so the UI never has to branch per provider. */
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

/**
 * Turn an AI failure into a human, actionable message for the UI.
 * The common "nothing happens / blank toast" cases are auth/key/provider
 * problems — tell the user exactly where to fix it instead of a cryptic line.
 */
export function aiErrorMessage(error: unknown): string {
  if (error instanceof AiError) {
    switch (error.code) {
      case 'unknown_provider':
        return 'No AI provider is configured. Add one in Settings → AI Provider, then try again.';
      case 'missing_api_key':
        return 'Your AI provider has no API key. Add it in Settings → AI Provider, then try again.';
      case 'unauthorized':
        return 'Your AI provider key was rejected. Check it in Settings → AI Provider, then try again.';
      case 'rate_limited':
        return 'The AI provider is rate-limiting requests. Wait a moment and try again.';
      case 'network':
        return 'Could not reach the AI provider. Check your connection and try again.';
      default:
        return error.message || 'The AI request failed.';
    }
  }
  if (error instanceof Error) return error.message;
  return 'The AI request failed.';
}
