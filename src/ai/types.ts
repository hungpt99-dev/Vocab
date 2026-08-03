import type { Explanation } from '@/shared/types/vocabulary';
import type { AiProviderId } from '@/shared/types/settings';

export interface ExplainRequest {
  word: string;
  /** Sentence the word appeared in, used to disambiguate the sense. */
  context?: string;
  /** Target language for the explanation. */
  language?: string;
}

export interface TranslateParagraph {
  text: string;
}

/** One paragraph of an article to be translated. */
export interface TranslateRequest {
  paragraphs: readonly TranslateParagraph[];
  /** Target language for the translation, e.g. "Chinese". */
  language: string;
}

/** Result of a structured paragraph translation. */
export interface TranslateResult {
  /** One translation per input paragraph, in the same order. */
  paragraphs: Array<{ text: string; translation: string }>;
}

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
  /** Translate a batch of article paragraphs, preserving their order. */
  translate(request: TranslateRequest, config: ProviderConfig): Promise<TranslateResult>;
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
  | 'server_error';

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
