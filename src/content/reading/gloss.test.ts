import { describe, expect, it } from 'vitest';
import { buildGlossBlock, buildSentenceBlock } from './gloss';
import type { WordAlignResult } from '@/ai/types';

describe('interlinear gloss rendering', () => {
  it('renders word-by-word glosses when pairs are present', () => {
    const result: WordAlignResult = {
      id: '0',
      text: 'I am a student',
      pairs: [
        { source: 'I', target: 'Tôi' },
        { source: 'am', target: 'là' },
        { source: 'a', target: 'một' },
        { source: 'student', target: 'học sinh' },
      ],
      translation: 'Tôi là một học sinh',
    };
    const block = buildGlossBlock(result);
    expect(block.className).toBe('avs-gloss-block');

    const glosses = block.querySelectorAll('.avs-gloss');
    expect(glosses.length).toBe(4);
    expect(glosses[0]!.querySelector('.avs-gloss-source')?.textContent).toBe('I');
    expect(glosses[0]!.querySelector('.avs-gloss-target')?.textContent).toBe('Tôi');
    expect(glosses[3]!.querySelector('.avs-gloss-target')?.textContent).toBe('học sinh');
  });

  it('falls back to a sentence block when no pairs are returned', () => {
    const result: WordAlignResult = {
      id: '0',
      text: 'I am a student',
      pairs: [],
      translation: 'Tôi là một học sinh',
    };
    const block = buildGlossBlock(result);
    const line = block.querySelector('.avs-inline-translation');
    expect(line).not.toBeNull();
    expect(line?.textContent).toBe('Tôi là một học sinh');
  });

  it('builds a standalone sentence block', () => {
    const line = buildSentenceBlock('Bonjour');
    expect(line.className).toBe('avs-inline-translation');
    expect(line.textContent).toBe('Bonjour');
  });
});
