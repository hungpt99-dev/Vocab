import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { reviewRepository } from '@/storage/review-repository';
import type { Explanation } from '@/shared/types/vocabulary';

function explanation(translation: string): Explanation {
  return {
    meaning: translation,
    simpleExplanation: translation,
    translation,
    examples: [],
    synonyms: [],
    antonyms: [],
    relatedWords: [],
    pronunciation: '',
    collocations: [],
    grammar: '',
    provider: 'openai',
    model: 'gpt-4o-mini',
    generatedAt: 1,
  };
}

async function seedForFeatures(): Promise<void> {
  const words = [
    'serendipity',
    'ubiquitous',
    'ephemeral',
    'meticulous',
    'gregarious',
  ];
  for (const word of words) {
    await vocabularyRepository.save({
      word,
      sentence: `Example sentence with ${word}.`,
      sourceTitle: word,
    });
    const saved = await vocabularyRepository.findByWord(word);
    if (saved) {
      await vocabularyRepository.update(saved.id, { explanation: explanation(`meaning of ${word}`) });
      await reviewRepository.ensureScheduled(saved);
    }
  }
  // Guarantee at least one due card for Review.
  const due = await reviewRepository.dueCards(50);
  if (due.length === 0) {
    const first = await vocabularyRepository.list({ sortBy: 'word', sortDirection: 'asc' });
    if (first[0]) await reviewRepository.ensureScheduled(first[0]);
  }
}

async function clickTab(name: RegExp): Promise<void> {
  await act(async () => {
    await userEvent.click(screen.getByRole('button', { name }));
  });
}

/** Buttons rendered as quiz/answer options — scoped to the question card. */
function optionButtons(): HTMLElement[] {
  const prompt = screen.getByText(/means…/i).closest('div') as HTMLElement;
  return within(prompt)
    .getAllByRole('button')
    .filter((b) => (b.textContent ?? '').trim().length > 0);
}

describe('popup feature tabs — Review, Quiz, Radar', () => {
  beforeEach(async () => {
    // fake-indexeddb persists in-memory across tests in this file; clear before
    // seeding so each test starts from a clean, deterministic library.
    await vocabularyRepository.clear();
    const due = await reviewRepository.dueCards(1000);
    await Promise.all(due.map((c) => reviewRepository.remove(c.id)));
    await seedForFeatures();
  });

  it('Review: loads due cards, flips, and grades', async () => {
    await act(async () => {
      render(<App />);
    });
    await clickTab(/^Review/i);

    await waitFor(() => expect(screen.getByText(/Review \d+ of \d+/i)).toBeInTheDocument());

    const card = screen.getByText(/serendipity|ubiquitous|ephemeral|meticulous|gregarious/i);
    await act(async () => {
      await userEvent.click(card);
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Good$/i })).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /^Good$/i }));
    });
    await waitFor(() =>
      expect(
        screen.getByText(/Review \d+ of \d+/i) ||
          screen.getByText(/All done for now|Nothing to review/i),
      ).toBeInTheDocument(),
    );
  });

  it('Quiz: builds questions from enriched words and can be answered', async () => {
    await act(async () => {
      render(<App />);
    });
    await clickTab(/^Quiz/i);

    const start = await screen.findByRole('button', { name: /Start quiz/i });
    await act(async () => {
      await userEvent.click(start);
    });
    // Quiz launched — questions are built from the enriched words.
    await waitFor(() => expect(screen.getByText(/Question \d+ of \d+/i)).toBeInTheDocument());

    const opts = optionButtons();
    expect(opts.length).toBeGreaterThan(0);
    await act(async () => {
      await userEvent.click(opts[0]!);
    });
    await waitFor(() => expect(screen.getByText(/Correct|Answer:/i)).toBeInTheDocument());
  });

  it('Radar: single search affordance, no duplicate Search button', async () => {
    await act(async () => {
      render(<App />);
    });
    await clickTab(/^Radar/i);

    expect(screen.getByLabelText(/Search vocabulary with Vocab Radar/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Search$/i })).toBeNull();
    expect(
      screen.getByText(/Find for my Radar|Set a learning goal in Settings/i),
    ).toBeInTheDocument();
  });
});
