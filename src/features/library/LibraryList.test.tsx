import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LibraryList } from './LibraryList';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

beforeEach(() => {
  vi.restoreAllMocks();
});

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
  sourceLanguage: '',
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
  it('shows a skeleton while loading', () => {
    const { container } = render(
      <LibraryList entries={[]} loading explainingId={null} filtered={false} {...handlers} />,
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows the first-run empty state', () => {
    render(<LibraryList entries={[]} loading={false} explainingId={null} filtered={false} {...handlers} />);
    expect(screen.getByText('No words yet')).toBeInTheDocument();
  });

  it('shows a filtered empty state', () => {
    render(<LibraryList entries={[]} loading={false} explainingId={null} filtered {...handlers} />);
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('renders entries as list items', () => {
    render(<LibraryList entries={[entry]} loading={false} explainingId={null} filtered={false} {...handlers} />);
    expect(screen.getByText('alpha')).toBeInTheDocument();
  });

  it('renders the first-run empty state when there are no entries but not loading', () => {
    const { rerender } = render(
      <LibraryList entries={[entry]} loading={false} explainingId={null} filtered={false} {...handlers} />,
    );
    expect(screen.getByText('alpha')).toBeInTheDocument();
    rerender(<LibraryList entries={[]} loading={false} explainingId={null} filtered {...handlers} />);
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });
});

