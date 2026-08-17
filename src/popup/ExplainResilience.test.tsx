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

  it('clears the "Asking your AI…" spinner and reconciles the saved explanation when sendMessage never resolves', async () => {
    const { sendMessage } = await import('@/shared/messaging/client');
    // A dead service-worker channel: sendMessage hangs forever.
    (sendMessage as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise<import('@/shared/messaging/contract').ResponseMap['explain']>(() => {}),
    );

    // Seed a word WITHOUT an explanation so the card starts with "AI explain".
    const saved = await vocabularyRepository.save({ word: 'quixotic', sentence: 'A quixotic plan.' });

    await act(async () => {
      render(<App />);
    });
    // Wait for the library to load the seeded word.
    const explainBtn = await screen.findByRole('button', { name: /AI explain/i });
    await act(async () => {
      await userEvent.click(explainBtn);
    });
    // Spinner is showing while "explaining" (no explanation yet).
    expect(screen.getByRole('status')).toHaveTextContent('Asking your AI');

    // Mid-flight, the (killed) background handler's earlier persistence lands in
    // storage. The popup must reconcile to it rather than stay stuck on the spinner.
    await act(async () => {
      await vocabularyRepository.update(saved.id, { explanation: makeExplanation() });
    });
    // Let the vocabulary-changed broadcast + the 50ms reconciliation timeout flush.
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    // Spinner gone AND the explanation reconciled: the card now offers the
    // collapsed enrich toggle (only rendered when entry.explanation is set).
    expect(screen.getByRole('button', { name: /Show enrich data/i })).toBeInTheDocument();
    // Expand it and confirm the persisted meaning is present.
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Show enrich data/i }));
    });
    expect(await screen.findByText(/impractical/i)).toBeInTheDocument();
  });
});
