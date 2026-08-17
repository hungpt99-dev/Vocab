import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App, __setExplainSettleMs } from './App';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { reviewRepository } from '@/storage/review-repository';
import type { Explanation } from '@/shared/types/vocabulary';

// Isolate the messaging mock to this file: the real client is kept except
// sendMessage, which we make hang to reproduce an MV3 service-worker eviction
// (the background explain call dies before sendMessage resolves).
vi.mock('@/shared/messaging/client', async (importActual) => {
  const actual = await importActual<typeof import('@/shared/messaging/client')>();
  // Default: resolve to undefined (no-op). Individual tests override specific
  // calls — e.g. make explain hang to simulate a killed service worker.
  return { ...actual, sendMessage: vi.fn(() => Promise.resolve(undefined)) };
});

function makeExplanation(): Explanation {
  return {
    meaning: 'impractical',
    simpleExplanation: 'impractical',
    translation: '風たつ',
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

describe('AI explain survives a lost response (VOC-?)', () => {
  beforeEach(async () => {
    // Keep the reconciliation timeout tiny so the test runs in real time.
    __setExplainSettleMs(50);
    await vocabularyRepository.clear();
    const due = await reviewRepository.dueCards(1000);
    await Promise.all(due.map((c) => reviewRepository.remove(c.id)));
  });

  it('clears the "Asking your AI…" spinner via the vocabulary-changed broadcast, even before sendMessage resolves', async () => {
    const { sendMessage } = await import('@/shared/messaging/client');
    // The background response is lost (service worker evicted). Make sendMessage
    // hang forever AND keep the reconciliation timeout far away, so this test
    // proves the broadcast-driven reload (not the timeout) clears the spinner.
    __setExplainSettleMs(10_000);
    (sendMessage as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise<import('@/shared/messaging/contract').ResponseMap['explain']>(() => {}),
    );

    // Seed a word WITHOUT an explanation so the card starts with "AI explain".
    const saved = await vocabularyRepository.save({ word: 'quixotic', sentence: 'A quixotic plan.' });

    await act(async () => {
      render(<App />);
    });
    const explainBtn = await screen.findByRole('button', { name: /AI explain/i });
    await act(async () => {
      await userEvent.click(explainBtn);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Asking your AI');

    // The background persisted the explanation and broadcast vocabulary-changed.
    // Simulate that broadcast reaching the popup's useVocabulary listener, which
    // reloads and gives the entry its explanation — the spinner must clear at once.
    await act(async () => {
      await vocabularyRepository.update(saved.id, { explanation: makeExplanation() });
      // Fire the same broadcast the background sends; the popup listener reloads.
      const { chromeMock } = await import('@/test/chrome-mock');
      (chromeMock().runtime.onMessage as unknown as { dispatch: (m: unknown) => void }).dispatch({
        type: 'vocabulary-changed',
      });
    });

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    // The explanation reconciled and is shown (expand to confirm).
    expect(screen.getByRole('button', { name: /Show enrich data/i })).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Show enrich data/i }));
    });
    expect(await screen.findByText(/impractical/i)).toBeInTheDocument();
  });
});
