import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryCard } from './EntryCard';
import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { makeVocabularyEntry } from '@/test/factories';
import { sendMessage } from '@/shared/messaging/client';

vi.mock('@/shared/messaging/client', () => ({
  sendMessage: vi.fn(async () => ''),
}));

const entry: VocabularyEntry = makeVocabularyEntry({
  id: 'e1',
  word: 'serendipity',
  wordKey: 'serendipity',
  sentence: 'Pure serendipity struck.',
  sourceUrl: 'https://example.com',
  sourceTitle: 'Example',
  note: 'from an article',
  tags: ['noun'],
  createdAt: Date.UTC(2026, 0, 1),
  updatedAt: Date.UTC(2026, 0, 1),
});

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

  describe('keyless translation (VOC-138)', () => {
    beforeEach(() => {
      vi.mocked(sendMessage).mockReset();
    });

    it('translates the word using the user target language, with no AI key', async () => {
      vi.mocked(sendMessage).mockResolvedValue('vận may mắn');
      setup();

      expect(await screen.findByText('vận may mắn')).toBeInTheDocument();
      expect(sendMessage).toHaveBeenCalledWith({ type: 'translate', payload: { text: 'serendipity' } });
    });

    it('translates the phrase too when the entry has one', async () => {
      vi.mocked(sendMessage).mockImplementation(
        (async (message: { type: string; payload: { text: string } }) => {
          if (message.type === 'translate' && message.payload.text === 'happy accident') {
            return 'vụ tai nạn may mắn';
          }
          return 'vận may mắn';
        }) as unknown as typeof sendMessage,
      );
      setup({ word: 'serendipity', phrase: 'happy accident' });

      expect(await screen.findByText('vận may mắn')).toBeInTheDocument();
      expect(screen.getByText('vụ tai nạn may mắn')).toBeInTheDocument();
      expect(sendMessage).toHaveBeenCalledWith({ type: 'translate', payload: { text: 'happy accident' } });
    });

    it('shows a skeleton while the translation is in flight', async () => {
      let resolveTranslation!: (value: string) => void;
      vi.mocked(sendMessage).mockReturnValue(
        new Promise<string>((resolve) => {
          resolveTranslation = resolve;
        }),
      );
      setup();

      expect(screen.getByTestId('entry-translation-skeleton')).toBeInTheDocument();
      await act(async () => {
        resolveTranslation('vận may mắn');
      });
      expect(await screen.findByText('vận may mắn')).toBeInTheDocument();
      expect(screen.queryByTestId('entry-translation-skeleton')).not.toBeInTheDocument();
    });

    it('falls back gracefully when the translation call fails', async () => {
      vi.mocked(sendMessage).mockRejectedValue(new Error('boom'));
      setup();

      await waitFor(() => {
        expect(screen.queryByTestId('entry-translation-skeleton')).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('serendipity')).toBeInTheDocument();
    });

    it('renders nothing when the translation equals the source', async () => {
      vi.mocked(sendMessage).mockResolvedValue('serendipity');
      setup();

      await waitFor(() => {
        expect(document.querySelector('[data-role="translation"]')).not.toBeInTheDocument();
      });
      expect(screen.getByText('serendipity')).toBeInTheDocument();
    });
  });
});
