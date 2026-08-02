import { AiError } from './types';

interface RequestOptions {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** POST JSON with unified timeout, abort and error normalisation. */
export async function postJson<T>({
  url,
  headers,
  body,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new AiError('timeout', 'Request timed out.')), timeoutMs);
  const onAbort = (): void => controller.abort(new AiError('aborted', 'Request cancelled.'));
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AiError(statusToCode(response.status), await describeFailure(response), response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    throw normalizeError(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function statusToCode(status: number): 'unauthorized' | 'rate_limited' | 'server_error' | 'network' {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  return 'network';
}

async function describeFailure(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  const detail = text.slice(0, 300).trim();
  return detail
    ? `Request failed (${response.status}): ${detail}`
    : `Request failed with status ${response.status}.`;
}

export function normalizeError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AiError('aborted', 'Request cancelled.');
  }
  if (error instanceof Error) {
    return new AiError('network', error.message || 'Network request failed.');
  }
  return new AiError('network', 'Network request failed.');
}

/** Join a base URL and a path without duplicating slashes. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
