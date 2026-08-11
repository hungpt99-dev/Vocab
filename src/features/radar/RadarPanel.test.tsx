import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadarPanel } from './RadarPanel';
import { chromeMock } from '@/test/chrome-mock';
import { DEFAULT_SETTINGS } from '@/storage/settings-repository';
import type { AnalyzePageResult } from './radar-service';

function seedSettings(overrides: Record<string, unknown> = {}): void {
  const settings = {
    ...DEFAULT_SETTINGS,
    providers: [{ id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'sk-test', enabled: true }],
    activeProviderId: 'p1',
    radar: { goal: 'backend engineering', autoScan: false, domains: [] },
    ...overrides,
  };
  void chromeMock().storage.local.set({ 'avs:settings': settings });
}

const SAMPLE_RESULT: AnalyzePageResult = {
  candidates: [
    { key: 'idempotent', text: 'idempotent', type: 'word', score: 98, reason: 'API', context: 'x', tier: 'high' },
  ],
  chunksAnalyzed: 1,
  chunksTotal: 1,
  partial: false,
};

describe('RadarPanel — Quick Search', () => {
  beforeEach(() => {
    seedSettings();
    (chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (message: { type: string }) => {
        if (message.type === 'radar:scan') {
          return { ok: true, data: SAMPLE_RESULT };
        }
        return { ok: true, data: null };
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    void chromeMock().storage.local.clear();
  });

  it('focuses the search input on Ctrl/Cmd+F when Radar is usable', async () => {
    await act(async () => {
      render(<RadarPanel />);
    });
    // Wait for settings to load so the shortcut is enabled.
    await screen.findByLabelText(/Search vocabulary with Vocab Radar/i);

    fireEvent.keyDown(document, { key: 'f', ctrlKey: true });
    const input = screen.getByLabelText(/Search vocabulary with Vocab Radar/i) as HTMLInputElement;
    expect(input).toHaveFocus();
  });

  it('does NOT intercept Ctrl/Cmd+F when no Radar goal is set', async () => {
    seedSettings({ radar: { goal: '', autoScan: false, domains: [] } });
    await act(async () => {
      render(<RadarPanel />);
    });
    await screen.findByLabelText(/Search vocabulary with Vocab Radar/i);

    const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
    const prevented = !document.dispatchEvent(event);
    // Browser's own find must not be suppressed when Radar is unusable.
    expect(prevented).toBe(false);
    const input = screen.getByLabelText(/Search vocabulary with Vocab Radar/i) as HTMLInputElement;
    expect(input).not.toHaveFocus();
  });

  it('runs the existing radar scan with the typed query as the goal override', async () => {
    await act(async () => {
      render(<RadarPanel />);
    });
    const input = (await screen.findByLabelText(/Search vocabulary with Vocab Radar/i)) as HTMLInputElement;

    await userEvent.type(input, 'serendipity');

    // Debounce (350ms) + async scan must complete; loading then results.
    await waitFor(
      () => expect(screen.getByText(/1 expression found for your goal/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );

    const calls = (chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const scanCall = calls.find((c) => c[0]?.type === 'radar:scan');
    expect(scanCall).toBeDefined();
    expect(scanCall![0].payload).toEqual({ goal: 'serendipity' });
  });

  it('clears the search query with Esc without destroying Radar state', async () => {
    await act(async () => {
      render(<RadarPanel />);
    });
    const input = (await screen.findByLabelText(/Search vocabulary with Vocab Radar/i)) as HTMLInputElement;

    await userEvent.type(input, 'serendipity');
    await waitFor(() => expect(screen.getByText(/1 expression found for your goal/i)).toBeInTheDocument(), {
      timeout: 2000,
    });
    expect(input).toHaveValue('serendipity');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
    // The previously fetched result stays visible (state preserved, not destroyed).
    expect(screen.getByText(/1 expression found for your goal/i)).toBeInTheDocument();
  });
});
