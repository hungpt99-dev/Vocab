/**
 * Keyless translation fallback using Google Translate's public endpoint.
 *
 * Bilingual reading is unusable out of the box when no AI provider key is
 * configured (the default OpenAI provider ships with an empty key). Rather than
 * leave the page silently monolingual, we fall back to this no-key endpoint so
 * the feature works immediately. It is used when the user has not configured an
 * AI provider with a working API key; a configured provider (with a key, or a
 * local Ollama/LM Studio that needs no key) always takes precedence.
 *
 * The endpoint is the same one the Google Translate web widget uses; it requires
 * no API key. We call it over HTTPS from the background service worker.
 */
import { toLanguageCode } from './language-codes';

const GTX_BASE = 'https://translate.googleapis.com/translate_a/single';

interface GtxResponse {
  0?: Array<[string] | [string, string]>;
}

/**
 * Separator used to batch per-word gloss translation into a single request.
 * Google Translate preserves line breaks, so joining source tokens with a newline
 * and splitting the result on newlines recovers one gloss per source token,
 * aligned by position.
 */
const SEP = '\n';

/** Translate a single string. Returns the source text unchanged on failure. */
async function translateText(text: string, target: string, source = 'auto'): Promise<string> {
  if (!text.trim()) return text;
  const params = new URLSearchParams({
    client: 'gtx',
    sl: source,
    tl: target,
    dt: 't',
    q: text.slice(0, 5000),
  });
  try {
    const response = await fetch(`${GTX_BASE}?${params.toString()}`, { method: 'GET' });
    if (!response.ok) return text;
    const data = (await response.json()) as GtxResponse;
    const chunks = (data[0] ?? []).map((segment) => segment[0] ?? '').join('');
    return chunks || text;
  } catch (err) {
    // Network/blocked failure: surface it so the caller can tell the user, rather
    // than silently returning the source text (which makes bilingual look broken
    // with no explanation). A clean 200 that returned empty still falls back to
    // the source above.
    throw err instanceof Error
      ? new Error(`Keyless translation failed to reach the network: ${err.message}`)
      : new Error('Keyless translation failed to reach the network.');
  }
}

export const googleTranslate = {
  /** Full-paragraph translation (used by sentence mode and as the line text). */
  async translate(paragraphs: string[], target: string): Promise<string[]> {
    const code = toLanguageCode(target);
    return Promise.all(paragraphs.map((text) => translateText(text, code)));
  },

  /**
   * Word alignment fallback. TWO requests per paragraph: the whole sentence (used
   * as the translation line) plus all source tokens joined by a delimiter (so
   * each token gets its exact single-word gloss back, aligned by position). This
   * avoids the per-word call explosion (hundreds of requests) that made the page
   * look empty for 10+ seconds, while still giving a correct gloss per word.
   */
  async align(
    paragraphs: Array<{ id: string; text: string }>,
    target: string,
  ): Promise<Array<{ id: string; text: string; pairs: Array<{ source: string; target: string }>; translation: string }>> {
    const code = toLanguageCode(target);
    return Promise.all(
      paragraphs.map(async (paragraph) => {
        const translation = await translateText(paragraph.text, code);
        const tokens = paragraph.text.match(/([\p{L}\p{N}][\p{L}\p{N}'.-]*[\p{L}\p{N}]|\p{L}|\p{N})/gu) ?? [];
        const joined = tokens.join(SEP);
        const joinedTranslation = tokens.length ? await translateText(joined, code) : '';
        const tokenTargets = joinedTranslation.split(SEP).map((t) => t.trim());
        const pairs = tokens.map((source, i) => {
          const tgt = tokenTargets[i] ?? '';
          // Drop a gloss that is identical to the source (untranslated token).
          return { source, target: tgt.toLowerCase() === source.toLowerCase() ? '' : tgt };
        });
        return { id: paragraph.id, text: paragraph.text, pairs, translation };
      }),
    );
  },
};

