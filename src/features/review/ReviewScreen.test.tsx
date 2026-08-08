import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewScreen } from './ReviewScreen';
import * as reviewModule from '@/storage/review-repository';

vi.mock('@/storage/review-repository', () => ({
  reviewRepository: {
    dueCards: vi.fn(async () => []),
    dueCount: vi.fn(async () => 0),
    recordGrade: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  },
}));

describe('ReviewScreen', () => {
  it('shows an empty state when there are no due cards', async () => {
    render(<ReviewScreen />);
    expect(await screen.findByText('Nothing to review')).toBeTruthy();
  });

  it('renders a due card and grades it', async () => {
    const dueCards = vi.fn(async () => [
      {
        id: 'id-1',
        wordKey: 'key-1',
        word: 'serendipity',
        entry: {
          id: 'id-1',
          word: 'serendipity',
          wordKey: 'key-1',
          phrase: '',
          sentence: 'A serendipity brought them together.',
          sourceUrl: '',
          sourceTitle: '',
          note: '',
          tags: [],
          favorite: false,
          sourceLanguage: 'en',
          explanation: {
            meaning: 'A happy accident.',
            simpleExplanation: '',
            translation: '',
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
        },
      },
    ]);
    const recordGrade = vi.fn(async () => undefined);
    vi.mocked(reviewModule.reviewRepository).dueCards = dueCards as never;
    vi.mocked(reviewModule.reviewRepository).recordGrade = recordGrade as never;

    render(<ReviewScreen />);
    expect(await screen.findByText('serendipity')).toBeTruthy();
    expect(await screen.findByText('Tap to reveal')).toBeTruthy();
  });
});
