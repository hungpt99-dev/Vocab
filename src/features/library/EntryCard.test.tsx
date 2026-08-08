import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryCard } from './EntryCard';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

const entry: VocabularyEntry = {
  id: 'e1',
  word: 'serendipity',
  wordKey: 'serendipity',
  phrase: '',
  sentence: 'Pure serendipity struck.',
  sourceUrl: 'https://example.com',
  sourceTitle: 'Example',
  note: 'from an article',
  tags: ['noun'],
  favorite: false,
  sourceLanguage: '',
  explanation: null,
  createdAt: Date.UTC(2026, 0, 1),
  updatedAt: Date.UTC(2026, 0, 1),
};

function setup(overrides: Partial<VocabularyEntry> = {}, explaining = false, extra: { onQuickAdd?: (word: string) => void } = {}) {
  const handlers = {
    onUpdate: vi.fn(async () => undefined),
    onDelete: vi.fn(async () => undefined),
    onToggleFavorite: vi.fn(async () => undefined),
    onExplain: vi.fn(async () => undefined),
    onQuickAdd: extra.onQuickAdd ?? vi.fn(),
  };
  render(<EntryCard entry={{ ...entry, ...overrides }} explaining={explaining} {...handlers} />);
  return handlers;
}

describe('EntryCard', () => {
  it('renders the word, sentence, note and tags', () => {
    setup();
    expect(screen.getByText('serendipity')).toBeInTheDocument();
    expect(screen.getByText(/Pure serendipity struck\./)).toBeInTheDocument();
    expect(screen.getByText('from an article')).toBeInTheDocument();
    expect(screen.getByText('noun')).toBeInTheDocument();
  });

  it('toggles favorite', async () => {
    const { onToggleFavorite } = setup();
    await userEvent.click(screen.getByRole('button', { name: /favorite serendipity/i }));
    expect(onToggleFavorite).toHaveBeenCalledWith('e1');
  });

  it('edits the word, note and tags', async () => {
    const { onUpdate } = setup();
    await userEvent.click(screen.getByRole('button', { name: /edit serendipity/i }));

    const wordInput = screen.getByLabelText('Word');
    await userEvent.clear(wordInput);
    await userEvent.type(wordInput, 'kismet');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).toHaveBeenCalledWith('e1', {
      word: 'kismet',
      note: 'from an article',
      tags: ['noun'],
    });
  });

  it('cancels editing without saving', async () => {
    const { onUpdate } = setup();
    await userEvent.click(screen.getByRole('button', { name: /edit serendipity/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('serendipity')).toBeInTheDocument();
  });

  it('requires confirmation before deleting', async () => {
    const { onDelete } = setup();
    await userEvent.click(screen.getByRole('button', { name: /delete serendipity/i }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('e1');
  });

  it('requests an AI explanation', async () => {
    const { onExplain } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'AI explain' }));
    expect(onExplain).toHaveBeenCalled();
  });

  it('shows a spinner while explaining', () => {
    setup({}, true);
    expect(screen.getByRole('status')).toHaveTextContent('Asking your AI');
  });

  it('renders related-phrase chips that quick-add on click', async () => {
    const user = userEvent.setup();
    const onQuickAdd = vi.fn();
    setup(
      {
        explanation: {
          meaning: 'A fortunate accident.',
          simpleExplanation: 'Good luck finding things.',
          translation: '',
          examples: [],
          synonyms: [],
          antonyms: [],
          relatedWords: ['fortune'],
          pronunciation: '',
          collocations: [],
          grammar: '',
          provider: 'openai',
          model: 'gpt-4o-mini',
          generatedAt: 1,
          relatedPhrases: ['happy accident'],
        },
      },
      false,
      { onQuickAdd },
    );

    expect(screen.getByText('Related vocabulary')).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: /happy accident/ });
    await user.click(chip);
    expect(onQuickAdd).toHaveBeenCalledWith('happy accident');
  });
});
