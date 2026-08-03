import type { SavedProvider } from '@/shared/types/settings';
import { AiError } from './types';

/**
 * Run a single provider attempt and, on a transient failure, retry once against
 * the configured fallback provider. Hard config errors (missing key,
 * unauthorized, malformed response) are never retried.
 */
export async function runActiveWithFallback<T>(
  run: (provider: SavedProvider) => Promise<T>,
  active: SavedProvider,
  fallback: SavedProvider | undefined,
): Promise<T> {
  try {
    return await run(active);
  } catch (primaryError) {
    if (!fallback) throw primaryError;
    const code = primaryError instanceof AiError ? primaryError.code : 'unknown';
    if (code === 'missing_api_key' || code === 'unauthorized' || code === 'bad_response') {
      throw primaryError;
    }
    return run(fallback);
  }
}
