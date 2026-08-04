import { describe, expect, it } from 'vitest';
import { wrapWords, buildSentenceBlock } from './gloss';
import type { WordAlignResult } from '@/ai/types';

describe('word gloss wrapping', () => {
  it('wraps matched source words in hoverable gloss spans', () => {
    const root = document.createElement('p');
    root.textContent = 'I am a student';
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
    wrapWords(root, result);

    const words = root.querySelectorAll<HTMLElement>('.avs-gloss-word');
    expect(words.length).toBe(4);
    expect(words[0]?.textContent).toBe('I');
    expect(words[0]?.dataset.avsGloss).toBe('Tôi');
    expect(words[3]?.textContent).toBe('student');
    expect(words[3]?.dataset.avsGloss).toBe('học sinh');
  });

  it('leaves unmatched words untouched and only wraps known words', () => {
    const root = document.createElement('p');
    root.textContent = 'Hello world example';
    const result: WordAlignResult = {
      id: '0',
      text: 'Hello world example',
      pairs: [{ source: 'Hello', target: 'Xin' }],
      translation: 'Xin chào',
    };
    wrapWords(root, result);

    const words = root.querySelectorAll<HTMLElement>('.avs-gloss-word');
    expect(words.length).toBe(1);
    expect(words[0]?.textContent).toBe('Hello');
    expect(root.textContent).toContain('world');
    expect(root.textContent).toContain('example');
  });

  it('does nothing when there are no pairs', () => {
    const root = document.createElement('p');
    root.textContent = 'Nothing to align';
    const result: WordAlignResult = {
      id: '0',
      text: 'Nothing to align',
      pairs: [],
      translation: '',
    };
    wrapWords(root, result);
    expect(root.querySelectorAll('.avs-gloss-word').length).toBe(0);
  });

  it('builds a standalone sentence block', () => {
    const line = buildSentenceBlock('Bonjour');
    expect(line.className).toBe('avs-inline-translation');
    expect(line.textContent).toBe('Bonjour');
  });

  it('keeps words with internal separators intact (Node.js, self-contained)', () => {
    const root = document.createElement('p');
    root.textContent = 'Build scalable Node.js server-side apps';
    const result: WordAlignResult = {
      id: '0',
      text: 'Build scalable Node.js server-side apps',
      pairs: [
        { source: 'Node.js', target: 'Node.js' },
        { source: 'scalable', target: 'có thể mở rộng' },
      ],
      translation: '',
    };
    wrapWords(root, result);

    const words = root.querySelectorAll<HTMLElement>('.avs-gloss-word');
    // "Node.js" must be ONE token, not "Node" + "js".
    expect(words.length).toBe(2);
    const node = Array.from(words).find((w) => w.textContent === 'Node.js');
    expect(node).toBeDefined();
    expect(node?.dataset.avsGloss).toBe('Node.js');
  });

  it('highlights accented words (Vietnamese) using Unicode letters', () => {
    const root = document.createElement('p');
    root.textContent = 'Học sinh giỏi';
    const result: WordAlignResult = {
      id: '0',
      text: 'Học sinh giỏi',
      pairs: [{ source: 'Học', target: 'study' }],
      translation: '',
    };
    wrapWords(root, result);

    const words = root.querySelectorAll<HTMLElement>('.avs-gloss-word');
    expect(words.length).toBe(1);
    expect(words[0]?.textContent).toBe('Học');
  });
});
