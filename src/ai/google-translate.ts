/**
 * Keyless translation fallback using Google Translate's public endpoint.
 *
 * Bilingual reading is unusable out of the box when no AI provider key is
 * configured (the default OpenAI provider ships with an empty key). Rather than
 * leave the page silently monolingual, we fall back to this no-key endpoint so
 * the feature works immediately. It is used ONLY when the user has not
 * configured an AI provider with an API key. When a provider IS configured, the
 * AI path (with word-level alignment and glosses) always wins.
 *
 * The endpoint is the same one the Google Translate web widget uses; it requires
 * no API key. We call it over HTTPS from the background service worker.
 */
import { toLanguageCode } from './language-codes';

const GTX_BASE = 'https://translate.googleapis.com/translate_a/single';

interface GtxResponse {
  0?: Array<[string] | [string, string]>;
}

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
    console.warn('[google-translate fallback] fetch failed:', err instanceof Error ? err.message : String(err));
    return text;
  }
}

export const googleTranslate = {
  /** Full-paragraph translation (used by sentence mode and as the line text). */
  async translate(paragraphs: string[], target: string): Promise<string[]> {
    const code = toLanguageCode(target);
    return Promise.all(paragraphs.map((text) => translateText(text, code)));
  },

  /**
   * Word alignment fallback: a faithful full-sentence `translation` per paragraph
   * plus ONE single-word gloss per source token (built by translating each token
   * individually, so no token ever absorbs a whole phrase).
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
        const targets = await Promise.all(tokens.map((token) => translateText(token, code)));
        const pairs = tokens.map((source, i) => ({ source, target: targets[i] ?? '' }));
        return { id: paragraph.id, text: paragraph.text, pairs, translation };
      }),
    );
  },
};
