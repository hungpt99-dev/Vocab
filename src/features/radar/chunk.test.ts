import { describe, expect, it } from 'vitest';
import { chunkText, splitParagraphs, splitSentences } from './chunk';

describe('chunkText', () => {
  it('returns no chunks for empty input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('returns a single chunk for small text', () => {
    const text = 'The system should gracefully degrade under heavy load.';
    const chunks = chunkText(text, { maxChars: 4000 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('gracefully degrade');
  });

  it('splits large text into multiple chunks under the limit', () => {
    const para = 'word '.repeat(200); // ~1000 chars
    const text = `${para}\n\n${para}\n\n${para}\n\n${para}\n\n${para}`; // ~5000 chars
    const chunks = chunkText(text, { maxChars: 1200 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1200);
    }
  });

  it('respects paragraph boundaries when possible', () => {
    const a = 'alpha '.repeat(50); // ~300 chars
    const b = 'beta '.repeat(50); // ~300 chars
    const text = `${a}\n\n${b}`;
    const chunks = chunkText(text, { maxChars: 350 });
    // Each paragraph is ~300 chars, so with a 350 limit they should stay separate chunks.
    expect(chunks.some((c) => c.includes('alpha') && !c.includes('beta'))).toBe(true);
    expect(chunks.some((c) => c.includes('beta') && !c.includes('alpha'))).toBe(true);
  });

  it('splits an oversized paragraph on sentence boundaries', () => {
    const sentences = Array.from({ length: 20 }, (_, i) => `Sentence number ${i} about resilience.`);
    const text = sentences.join(' ');
    const chunks = chunkText(text, { maxChars: 400 });
    expect(chunks.length).toBeGreaterThan(1);
    // No chunk should end mid-word badly; each chunk should contain whole sentences.
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(400);
      expect(chunk.trim().endsWith('.')).toBe(true);
    }
  });

  it('hard-splits a gigantic single sentence as a last resort', () => {
    const giant = 'a'.repeat(5000);
    const chunks = chunkText(giant, { maxChars: 1000 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(1000);
  });

  it('splitParagraphs trims and drops blank blocks', () => {
    expect(splitParagraphs('\n\n  Hello.  \n\nWorld.\n\n')).toEqual(['Hello.', 'World.']);
  });

  it('splitSentences keeps sentence fragments', () => {
    expect(splitSentences('Hello world. How are you? Fine')).toEqual([
      'Hello world.',
      'How are you?',
      'Fine',
    ]);
  });
});
