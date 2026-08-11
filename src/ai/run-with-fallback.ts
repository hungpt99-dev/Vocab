import type { SavedProvider } from '@/shared/types/settings';

/**
 * Run a single provider attempt and, on a transient failure, retry once against
 * the configured fallback provider.
 *
 * Additionally, if every configured provider fails AND a keyless fallback is
 * supplied, use it so bilingual reading still works out of the box even when the
 * user has entered an invalid/empty key (the previous behavior left the page
 * silently monolingual).
 */
export interface KeylessFallback {
  kind: 'translate' | 'align';
  language: string;
  /** Plain paragraph texts (translate mode). */
  paragraphs?: string[];
  /** id+text pairs (align mode). */
  pairs?: Array<{ id: string; text: string }>;
}

export async function runActiveWithFallback<T>(
  run: (provider: SavedProvider) => Promise<T>,
  active: SavedProvider,
  fallback: SavedProvider | undefined,
  keyless?: KeylessFallback,
): Promise<T> {
  let primaryError: unknown;

  const runKeyless = async (): Promise<T> => {
    if (!keyless) throw primaryError;
    const { googleTranslate } = await import('./google-translate');
    if (keyless.kind === 'translate' && keyless.paragraphs) {
      return (await googleTranslate.translate(keyless.paragraphs, keyless.language)) as unknown as T;
    }
    if (keyless.kind === 'align' && keyless.pairs) {
      return (await googleTranslate.align(keyless.pairs, keyless.language)) as unknown as T;
    }
    throw primaryError;
  };

  try {
    return await run(active);
  } catch (err) {
    primaryError = err;
    if (fallback) {
      try {
        return await run(fallback);
      } catch (fbErr) {
        primaryError = fbErr;
        // fall through to keyless
      }
    }
    return runKeyless();
  }
}
