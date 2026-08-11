/** Chunking utilities for Vocabulary Goal Mode.
 *
 * Splits cleaned page text into chunks small enough to send to the AI, while
 * respecting natural boundaries (paragraphs, then sentences) so we never cut a
 * sentence in half when it can be avoided. Pure functions — easy to unit test.
 */

export const DEFAULT_MAX_CHUNK_CHARS = 4000;
export const DEFAULT_CHUNK_OVERLAP_CHARS = 200;

export interface ChunkOptions {
  /** Soft max characters per chunk. */
  maxChars?: number;
  /** Overlap between consecutive chunks so items near a boundary aren't missed. */
  overlapChars?: number;
}

/** Split text into paragraphs (blank-line separated), tolerating single newlines. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Split a paragraph into sentences on common sentence terminators. */
export function splitSentences(paragraph: string): string[] {
  const parts = paragraph.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g);
  if (!parts) return paragraph.trim() ? [paragraph.trim()] : [];
  return parts.map((s) => s.trim()).filter(Boolean);
}

/**
 * Chunk cleaned page text.
 * Strategy:
 *  1. Break into paragraphs.
 *  2. Accumulate paragraphs into a chunk until adding the next would exceed
 *     maxChars; then flush and start the next chunk with an overlap tail.
 *  3. If a single paragraph exceeds maxChars, split it on sentence boundaries
 *     (and as a last resort on a hard character cut) so we still respect
 *     sentence boundaries where possible.
 * Empty input yields an empty array (no degenerate chunks).
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHUNK_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_CHUNK_OVERLAP_CHARS;

  const trimmed = text.trim();
  if (!trimmed) return [];

  const paragraphs = splitParagraphs(trimmed);
  const chunks: string[] = [];
  let current = '';

  const flush = (): void => {
    const c = current.trim();
    if (c) chunks.push(c);
    current = '';
  };

  const overlapTail = (chunk: string): string => {
    if (overlapChars <= 0) return '';
    const tail = chunk.slice(-overlapChars);
    // Prefer to start the overlap at a sentence/word boundary.
    const sentenceStart = tail.search(/[.!?]\s+/);
    const start = sentenceStart > 0 ? sentenceStart + 1 : 0;
    const atSpace = tail.slice(start).search(/\s/);
    return tail.slice(start + (atSpace > 0 ? atSpace : 0)).trim();
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      if (current && current.length + paragraph.length + 1 > maxChars) {
        const carry = overlapTail(current);
        flush();
        current = carry ? `${carry}\n\n${paragraph}` : paragraph;
      } else {
        current = current ? `${current}\n\n${paragraph}` : paragraph;
      }
      continue;
    }

    // Oversized paragraph: flush what we have, then split it by sentence.
    if (current) {
      flush();
    }
    const sentences = splitSentences(paragraph);
    let big = '';
    for (const sentence of sentences) {
      if (big && big.length + sentence.length + 1 > maxChars) {
        const carry = overlapTail(big);
        chunks.push(big.trim());
        big = carry ? `${carry} ${sentence}` : sentence;
      } else {
        big = big ? `${big} ${sentence}` : sentence;
      }
    }
    if (big.trim()) chunks.push(big.trim());
    current = '';
  }

  flush();

  // Defensive: if a single chunk is still somehow over the limit (e.g. one
  // gigantic sentence), hard-split it so we never send an unbounded payload.
  const hardSplit: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChars) {
      hardSplit.push(chunk);
      continue;
    }
    for (let i = 0; i < chunk.length; i += maxChars) {
      hardSplit.push(chunk.slice(i, i + maxChars).trim());
    }
  }

  return hardSplit.filter(Boolean);
}
