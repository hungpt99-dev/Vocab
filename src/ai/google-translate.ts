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
import { tokenizeWords } from '@/shared/lib/text';

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
   * Word alignment fallback. Batches the WHOLE chunk into just two requests:
   * one for the full-sentence translation lines (paragraphs joined by a blank
   * line, split back out) and one for every source token joined by a delimiter
   * (all tokens of all paragraphs in a single blob). This avoids the per-paragraph
   * (or per-token) request explosion that made bilingual reading painfully slow.
   *
   * The joined token blob can drift — a token like "world" may translate to
   * *several* target words, or Google may merge/reorder the delimiter lines — so
   * the split-by-delimiter index no longer lines up with the source tokens and
   * glosses land on the wrong word. When the token counts don't match we fall
   * back to translating each token individually (bounded concurrency) so every
   * source word maps to its own exact translation, aligned by position.
   */
  async align(
    paragraphs: Array<{ id: string; text: string }>,
    target: string,
  ): Promise<Array<{ id: string; text: string; pairs: Array<{ source: string; target: string }>; translation: string }>> {
    const code = toLanguageCode(target);
    if (paragraphs.length === 0) return [];

    // Gather tokens synchronously so both network requests can fire in parallel.
    const perParagraphTokens = paragraphs.map((p) => tokenizeWords(p.text));
    const allTokens = perParagraphTokens.flat();
    const joinedSentences = paragraphs.map((p) => p.text).join(PARA_SEP);
    const joinedTokens = allTokens.join(SEP);

    // 1) Full-sentence translation lines AND 2) word glosses issued together —
    // Google preserves the blank-line / newline structure, so a single request
    // each covers the whole chunk. Running them concurrently halves the latency.
    const [joinedSentenceTranslation, joinedTokenTranslation] = await Promise.all([
      translateText(joinedSentences, code),
      allTokens.length > 0 ? translateText(joinedTokens, code) : Promise.resolve(''),
    ]);

    const sentenceLines = splitByParagraph(joinedSentenceTranslation);
    // Pad/trim so every paragraph gets a line even if the separator was dropped.
    while (sentenceLines.length < paragraphs.length) sentenceLines.push('');
    const translations = sentenceLines.slice(0, paragraphs.length);

    let allTargets: string[];
    if (allTokens.length === 0) {
      allTargets = [];
    } else {
      const split = joinedTokenTranslation.split(SEP).map((t) => t.trim());
      allTargets = split.length === allTokens.length ? split : await translateTokensIndividually(allTokens, code);
    }

    // 3) Distribute the flattened targets back into per-paragraph pairs.
    let cursor = 0;
    return paragraphs.map((paragraph, pi) => {
      const tokens = perParagraphTokens[pi] ?? [];
      const pairs = tokens.map((source) => {
        const tgt = allTargets[cursor] ?? '';
        cursor += 1;
        // Drop a gloss that is identical to the source (untranslated token).
        return { source, target: tgt.toLowerCase() === source.toLowerCase() ? '' : tgt };
      });
      return { id: paragraph.id, text: paragraph.text, pairs, translation: translations[pi] ?? '' };
    });
  },
};

/** Blank-line separator between paragraphs (Google Translate preserves it). */
const PARA_SEP = '\n\n';

/** Split a joined translation back into per-paragraph lines on blank lines. */
function splitByParagraph(text: string): string[] {
  return text.split(PARA_SEP).map((line) => line.trim());
}

/**
 * Translate each token separately (bounded concurrency) so every source word
 * maps to its own translation, aligned by position. Used only when the joined
 * fast path drifts — see `align` above.
 */
async function translateTokensIndividually(tokens: string[], code: string): Promise<string[]> {
  const out: string[] = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < tokens.length; i += CONCURRENCY) {
    const slice = tokens.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((token) => translateText(token, code)));
    out.push(...results.map((r) => r.trim()));
  }
  return out;
}

