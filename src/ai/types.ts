import type { Explanation } from '@/shared/types/vocabulary';
import type { AiProviderId } from '@/shared/types/settings';

export interface ExplainRequest {
  word: string;
  /** Sentence the word appeared in, used to disambiguate the sense. */
  context?: string;
  /** Target language for the explanation. */
  language?: string;
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
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
