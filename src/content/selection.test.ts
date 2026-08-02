import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSelection } from './selection';

beforeEach(() => {
  document.body.innerHTML = '';
  document.title = 'Test Page';
});

function stubSelection(text: string, node: Node | null) {
  vi.spyOn(document, 'getSelection').mockReturnValue({
    toString: () => text,
    anchorNode: node,
  } as unknown as Selection);
}

describe('readSelection', () => {
  it('returns the word, sentence, url and title', () => {
    document.body.innerHTML = '<p>I love cake. Serendipity struck me today! Then I left.</p>';
    const paragraph = document.querySelector('p')!;
    stubSelection('Serendipity', paragraph.firstChild);

    const result = readSelection();
    expect(result).toMatchObject({
      word: 'Serendipity',
      sentence: 'Serendipity struck me today!',
      sourceTitle: 'Test Page',
    });
    expect(result?.sourceUrl).toContain('http');
  });

  it('returns null when nothing is selected', () => {
    stubSelection('   ', null);
    expect(readSelection()).toBeNull();
  });

  it('falls back to the selection when there is no context', () => {
    stubSelection('word', null);
    expect(readSelection()?.sentence).toBe('word');
  });
});
