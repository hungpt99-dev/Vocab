import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProgressScreen } from './ProgressScreen';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { makeVocabularyEntry } from '@/test/factories';

vi.mock('@/storage/vocabulary-repository', () => ({
  vocabularyRepository: {
    list: vi.fn(),
    stats: vi.fn(),
  },
}));

function entry(word: string, createdAt: number): VocabularyEntry {
  return makeVocabularyEntry({
    id: `id-${word}`,
    word,
    wordKey: `k-${word}`,
    sourceLanguage: 'en',
    createdAt,
    updatedAt: createdAt,
  });
}

describe('ProgressScreen', () => {
  it('shows an empty state when there are no words', async () => {
    vi.mocked(vocabularyRepository.list).mockResolvedValueOnce([]);
    vi.mocked(vocabularyRepository.stats).mockResolvedValueOnce({ total: 0, addedToday: 0, streak: 0 });
    render(<ProgressScreen />);
    expect(await screen.findByText('No progress yet')).toBeTruthy();
  });

  it('renders stats and a history chart once words exist', async () => {
    const now = Date.now();
    vi.mocked(vocabularyRepository.list).mockResolvedValueOnce([entry('apple', now), entry('book', now)]);
    vi.mocked(vocabularyRepository.stats).mockResolvedValueOnce({ total: 2, addedToday: 1, streak: 3 });
    render(<ProgressScreen />);
    await waitFor(() => expect(screen.getByText('Total')).toBeTruthy());
    // total and last-7-days both equal 2 for these two words saved today.
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('3')).toBeTruthy(); // streak stat
    // Chart svg present with title tooltips.
    expect(document.querySelector('svg[aria-label="Words saved per day"]')).toBeTruthy();
  });
});
