import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Explanation } from '@/shared/types/vocabulary';
import type { ToolbarState } from './toolbar';
import { ExplainPanel } from './explain-panel';

const explanation: Explanation = {
  meaning: 'The cat sat down on the mat.',
  simpleExplanation: 'The cat sat on a small rug.',
  translation: 'Le chat s’est assis sur le tapis.',
  examples: ['The cat sat by the fire.'],
  synonyms: [],
  antonyms: [],
  relatedWords: ['cat: a small animal', 'mat: a floor covering'],
  pronunciation: '',
  collocations: [],
  grammar: 'Subject + verb + prepositional phrase.',
  provider: 'openai',
  model: 'gpt-4o-mini',
  generatedAt: 1,
};

function makeState(text: string): ToolbarState {
  return {
    text,
    sentence: text,
    sourceUrl: 'https://example.com',
    sourceTitle: 'Example',
    unit: 'sentence',
    rect: { top: 100, bottom: 114, left: 20, width: 50 },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('ExplainPanel', () => {
  it('renders the analysis label and explanation content', () => {
    const panel = new ExplainPanel();
    panel.show('Explain sentence', makeState('The cat sat down.'), explanation);

    const element = document.getElementById('avs-panel')!;
    expect(element.hidden).toBe(false);
    expect(element.getAttribute('role')).toBe('dialog');
    expect(element.querySelector('.avs-panel-title')?.textContent).toBe('Explain sentence');
    expect(element.querySelector('.avs-panel-source')?.textContent).toBe('The cat sat down.');
    expect(element.textContent).toContain('The cat sat down on the mat.');
    expect(element.textContent).toContain('Le chat s’est assis sur le tapis.');
    expect(element.querySelectorAll('.avs-panel-list li')).toHaveLength(3);
    expect(element.querySelector('[aria-label="Close"]')).not.toBeNull();
    panel.destroy();
  });

  it('omits empty sections and closes on the close button', () => {
    const panel = new ExplainPanel();
    const sparse: Explanation = { ...explanation, grammar: '', translation: '', relatedWords: [] };
    panel.show('Simplify', makeState('The cat sat down.'), sparse);

    const element = document.getElementById('avs-panel')!;
    expect(element.textContent).not.toContain('Grammar');
    expect(element.querySelector('.avs-panel-close')?.dispatchEvent(new MouseEvent('click'))).toBe(true);
    expect(panel.isVisible).toBe(false);
    panel.destroy();
  });

  it('hides on Escape', () => {
    const panel = new ExplainPanel();
    panel.show('Summarize', makeState('The cat sat down.'), explanation);
    expect(panel.isVisible).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.isVisible).toBe(false);
    panel.destroy();
  });
});
