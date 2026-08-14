import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizScreen } from './QuizScreen';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { makeVocabularyEntry } from '@/test/factories';

vi.mock('@/storage/vocabulary-repository', () => ({
  vocabularyRepository: {
    list: vi.fn(),
  },
}));

function entry(word: string, translation: string): VocabularyEntry {
  return makeVocabularyEntry({
    id: `id-${word}`,
    word,
    wordKey: `key-${word}`,
    sourceLanguage: 'en',
    explanation: {
      meaning: translation,
      simpleExplanation: '',
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
    },
    createdAt: 1,
    updatedAt: 1,
  });
}

describe('QuizScreen', () => {
  it('asks to save more words when the library is too small', async () => {
    vi.mocked(vocabularyRepository.list).mockResolvedValueOnce([]);
    render(<QuizScreen />);
    expect(await screen.findByText('Not enough words yet')).toBeTruthy();
  });

  it('starts a quiz and records an answer', async () => {
    const entries = [
      entry('apple', 'táo'),
      entry('book', 'sách'),
      entry('cat', 'mèo'),
      entry('dog', 'chó'),
    ];
    vi.mocked(vocabularyRepository.list).mockResolvedValueOnce(entries);

    render(<QuizScreen />);
    fireEvent.click(await screen.findByText('Start quiz'));

    // Click the first option; the result line shows "Correct" or the right answer.
    const optionButtons = await screen.findAllByRole('button');
    const firstOption = optionButtons.find((b) => b.className.includes('border-slate-200'))!;
    fireEvent.click(firstOption);

    await waitFor(() =>
      expect(screen.getByText(/Correct|Answer:/)).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole('button', { name: /Next|Finish/ }));
  });
});
