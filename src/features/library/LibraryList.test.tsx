import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { LibraryList } from './LibraryList';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

interface CapturedObserver {
  callback: ResizeObserverCallback;
  target: Element;
}

// react-window measures rows via ResizeObserver, which jsdom does not implement.
// Capture instances so tests can drive the callback and simulate layout changes.
let observers: CapturedObserver[] = [];

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      private callback: ResizeObserverCallback;
      observe(target: Element): void {
        observers.push({ callback: this.callback, target });
      }
      unobserve(): void {}
      disconnect(): void {}
    };
  }
});

beforeEach(() => {
  observers = [];
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

  it('measures the inner content wrapper, not the react-window row box', () => {
    render(<LibraryList entries={[entry]} loading={false} explainingId={null} filtered={false} {...handlers} />);
    const row = screen.getByRole('listitem');
    expect(observers.map((o) => o.target)).toContain(row.firstElementChild);
    expect(observers.map((o) => o.target)).not.toContain(row);
  });

  it('grows the row to the measured content height on expand so rows do not overlap', () => {
    const withExplanation: VocabularyEntry = {
      ...entry,
      explanation: {
        meaning: 'The first letter of the alphabet.',
        simpleExplanation: '',
        translation: '',
        examples: [],
        synonyms: [],
        antonyms: [],
        relatedWords: [],
        pronunciation: '',
        collocations: [],
        grammar: '',
        relatedPhrases: [],
        provider: 'test',
        model: '',
        generatedAt: 1,
      },
    };
    render(
      <LibraryList
        entries={[withExplanation]}
        loading={false}
        explainingId={null}
        filtered={false}
        {...handlers}
      />,
    );

    const row = screen.getByRole('listitem');
    const wrapper = row.firstElementChild as HTMLElement;
    const captured = observers.find((o) => o.target === wrapper);
    expect(captured).toBeDefined();

    // Simulate the browser reporting a taller content box after the enrich
    // section is expanded (jsdom getBoundingClientRect is always 0).
    const heightSpy = vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 300,
      bottom: 96,
      left: 0,
      width: 300,
      height: 96,
      toJSON: () => ({}),
    });
    const fire = (height: number): void => {
      heightSpy.mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        right: 300,
        bottom: height,
        left: 0,
        width: 300,
        height,
        toJSON: () => ({}),
      });
      act(() => {
        captured!.callback([], null as unknown as ResizeObserver);
      });
    };

    fire(220);
    expect(row.style.height).toBe('220px');

    // Collapse back down: the row shrinks with the content instead of leaving
    // dead space that would clip or misplace following rows.
    fire(96);
    expect(row.style.height).toBe('96px');

    // Exactly one instance of each action icon on the card.
    expect(screen.getAllByLabelText(/favorite alpha/i)).toHaveLength(1);
    expect(screen.getAllByLabelText(/edit alpha/i)).toHaveLength(1);
    expect(screen.getAllByLabelText(/delete alpha/i)).toHaveLength(1);
  });
});

