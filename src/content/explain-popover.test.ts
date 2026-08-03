import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExplainRequest } from '@/shared/types/explain';
import type { Explanation } from '@/shared/types/vocabulary';
import { ExplainPopover, toExplainUnit, type ExplainPopoverInput } from './explain-popover';

const input: ExplainPopoverInput = {
  text: 'serendipity',
  unit: 'word',
  rect: { top: 100, bottom: 114, left: 20, width: 50 },
  context: 'Serendipity struck me today.',
  sourceUrl: 'https://example.com',
  sourceTitle: 'Example',
};

const explanation: Explanation = {
  meaning: 'A fortunate accident.',
  simpleExplanation: 'Finding something good by luck.',
  translation: 'Serendipidad',
  examples: ['It was serendipity.', 'Pure serendipity!'],
  synonyms: ['luck', 'chance'],
  antonyms: ['misfortune'],
  relatedWords: ['fortune'],
  pronunciation: '/ˌsɛrənˈdɪpɪti/',
  collocations: ['sheer serendipity'],
  grammar: 'Noun, uncountable.',
  partOfSpeech: 'noun',
  provider: 'openai',
  model: 'gpt-4o-mini',
  generatedAt: 1,
};

function popoverElement(): HTMLElement {
  return document.getElementById('avs-explain')!;
}

function sectionLabels(): string[] {
  return [...popoverElement().querySelectorAll('.avs-explain-section summary')].map(
    (node) => node.textContent ?? '',
  );
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('toExplainUnit', () => {
  it('keeps word, phrase and sentence', () => {
    expect(toExplainUnit('word')).toBe('word');
    expect(toExplainUnit('phrase')).toBe('phrase');
    expect(toExplainUnit('sentence')).toBe('sentence');
  });

  it('treats a paragraph selection as a sentence', () => {
    expect(toExplainUnit('paragraph')).toBe('sentence');
  });
});

describe('ExplainPopover', () => {
  it('does not call the AI when it opens', () => {
    const explainFn = vi.fn(async () => explanation);
    const popover = new ExplainPopover(explainFn);

    popover.show(input);

    expect(popover.isVisible).toBe(true);
    expect(explainFn).not.toHaveBeenCalled();
    expect(popoverElement().querySelector('[data-action="explain"]')).toBeTruthy();
    popover.destroy();
  });

  it('sends the full context to the explain function on click', async () => {
    const explainFn = vi.fn(async (_request: ExplainRequest) => explanation);
    const popover = new ExplainPopover(explainFn);
    popover.show(input);

    popoverElement().querySelector<HTMLButtonElement>('[data-action="explain"]')!.click();
    await vi.waitFor(() => expect(explainFn).toHaveBeenCalledTimes(1));

    const request = explainFn.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      word: 'serendipity',
      unit: 'word',
      context: 'Serendipity struck me today.',
      sourceUrl: 'https://example.com',
      sourceTitle: 'Example',
      sourceLanguage: 'English',
    });
    popover.destroy();
  });

  it('renders the word sections as expandable details', async () => {
    const popover = new ExplainPopover(vi.fn(async () => explanation));
    popover.show(input);
    popoverElement().querySelector<HTMLButtonElement>('[data-action="explain"]')!.click();

    await vi.waitFor(() => {
      expect(popoverElement().querySelectorAll('.avs-explain-section')).toHaveLength(9);
    });

    expect(sectionLabels()).toEqual([
      'Meaning',
      'Pronunciation',
      'Translation',
      'Part of speech',
      'Examples',
      'Synonyms',
      'Antonyms',
      'Collocations',
      'Related words',
    ]);
    expect(popoverElement().querySelectorAll('.avs-explain-section')[0]?.hasAttribute('open')).toBe(true);
    expect(popoverElement().textContent).toContain('A fortunate accident.');
    expect(popoverElement().textContent).toContain('openai · gpt-4o-mini');
    popover.destroy();
  });

  it('renders the phrase sections per spec', async () => {
    const phrase = { ...input, text: 'a piece of cake', unit: 'phrase' as const };
    const phraseExplanation: Explanation = {
      ...explanation,
      meaning: 'Something that is very easy to do.',
      grammar: 'Noun phrase, often after "be".',
      usage: 'Informal; common in spoken English.',
    };
    const popover = new ExplainPopover(vi.fn(async () => phraseExplanation));
    popover.show(phrase);
    popoverElement().querySelector<HTMLButtonElement>('[data-action="explain"]')!.click();

    await vi.waitFor(() => {
      expect(popoverElement().querySelectorAll('.avs-explain-section')).toHaveLength(5);
    });

    expect(sectionLabels()).toEqual(['Explanation', 'Translation', 'Grammar', 'Usage', 'Examples']);
    popover.destroy();
  });

  it('renders the sentence sections per spec', async () => {
    const sentence = {
      ...input,
      text: 'Serendipity struck me today.',
      unit: 'sentence' as const,
      context: 'It was the first time I saw her.',
    };
    const sentenceExplanation: Explanation = {
      ...explanation,
      meaning: 'She met me for the first time by chance.',
      summary: 'The speaker met someone for the first time, by chance.',
      translation: 'La serendipia me golpeó hoy.',
      grammar: 'Past simple; subject-verb-object.',
      difficultVocabulary: ['serendipity: a fortunate accident'],
    };
    const popover = new ExplainPopover(vi.fn(async () => sentenceExplanation));
    popover.show(sentence);
    popoverElement().querySelector<HTMLButtonElement>('[data-action="explain"]')!.click();

    await vi.waitFor(() => {
      expect(popoverElement().querySelectorAll('.avs-explain-section')).toHaveLength(4);
    });

    expect(sectionLabels()).toEqual([
      'Summary',
      'Translation',
      'Grammar',
      'Difficult vocabulary',
    ]);
    popover.destroy();
  });

  it('skips empty sections', async () => {
    const sparse: Explanation = {
      ...explanation,
      pronunciation: '',
      collocations: [],
      synonyms: [],
      antonyms: [],
      relatedWords: [],
    };
    const popover = new ExplainPopover(vi.fn(async () => sparse));
    popover.show(input);
    popoverElement().querySelector<HTMLButtonElement>('[data-action="explain"]')!.click();

    await vi.waitFor(() => {
      expect(sectionLabels()).not.toContain('Pronunciation');
      expect(sectionLabels()).not.toContain('Collocations');
    });
    expect(popoverElement().querySelectorAll('.avs-explain-section')).toHaveLength(4);
    popover.destroy();
  });

  it('shows an error and allows retry', async () => {
    const explainFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('The API key is missing.'))
      .mockResolvedValueOnce(explanation);
    const popover = new ExplainPopover(explainFn);
    popover.show(input);

    popoverElement().querySelector<HTMLButtonElement>('[data-action="explain"]')!.click();
    await vi.waitFor(() => {
      expect(popoverElement().querySelector('[role="alert"]')?.textContent).toBe(
        'The API key is missing.',
      );
    });

    popoverElement().querySelector<HTMLButtonElement>('[data-action="explain"]')!.click();
    await vi.waitFor(() => expect(explainFn).toHaveBeenCalledTimes(2));
    expect(popoverElement().textContent).toContain('A fortunate accident.');
    popover.destroy();
  });

  it('closes via the close button', () => {
    const popover = new ExplainPopover(vi.fn(async () => explanation));
    popover.show(input);

    popoverElement().querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click();

    expect(popover.isVisible).toBe(false);
    popover.destroy();
  });

  it('closes with Escape', () => {
    const popover = new ExplainPopover(vi.fn(async () => explanation));
    popover.show(input);

    popoverElement().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(popover.isVisible).toBe(false);
    popover.destroy();
  });
});
