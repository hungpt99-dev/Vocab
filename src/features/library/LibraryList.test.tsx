import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LibraryList } from './LibraryList';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

const entry: VocabularyEntry = {
  id: 'e1',
  word: 'alpha',
  wordKey: 'alpha',
  phrase: '',
  sentence: '',
  sourceUrl: '',
  sourceTitle: '',
  note: '',
  tags: [],
  favorite: false,
  explanation: null,
  createdAt: 1,
  updatedAt: 1,
};

const handlers = {
  onUpdate: vi.fn(async () => undefined),
  onDelete: vi.fn(async () => undefined),
  onToggleFavorite: vi.fn(async () => undefined),
  onExplain: vi.fn(async () => undefined),
};

describe('LibraryList', () => {
  it('shows a loading state', () => {
    render(<LibraryList entries={[]} loading explainingId={null} filtered={false} {...handlers} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your vocabulary');
  });

  it('shows the first-run empty state', () => {
    render(<LibraryList entries={[]} loading={false} explainingId={null} filtered={false} {...handlers} />);
    expect(screen.getByText('No words yet')).toBeInTheDocument();
  });

  it('shows a filtered empty state', () => {
    render(<LibraryList entries={[]} loading={false} explainingId={null} filtered {...handlers} />);
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('renders entries in a list', () => {
    render(<LibraryList entries={[entry]} loading={false} explainingId={null} filtered={false} {...handlers} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('alpha')).toBeInTheDocument();
  });
});
