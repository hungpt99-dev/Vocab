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
    radar: { goal: 'backend engineering' },
    ...overrides,
  };
  void chromeMock().storage.local.set({ 'avs:settings': settings });
}

const SAMPLE_RESULT: AnalyzePageResult = {
  candidates: [
    { key: 'idempotent', familyKey: 'idempotent', text: 'idempotent', type: 'word', score: 98, reason: 'API', context: 'x', tier: 'high' },
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
    await screen.findByLabelText(/Radar smart search/i);

    fireEvent.keyDown(document, { key: 'f', ctrlKey: true });
    const input = screen.getByLabelText(/Radar smart search/i) as HTMLInputElement;
    expect(input).toHaveFocus();
  });

  it('does NOT intercept Ctrl/Cmd+F when no Radar goal is set', async () => {
    seedSettings({ radar: { goal: '' } });
    await act(async () => {
      render(<RadarPanel />);
    });
    await screen.findByLabelText(/Radar smart search/i);

    const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
    const prevented = !document.dispatchEvent(event);
    // Browser's own find must not be suppressed when Radar is unusable.
    expect(prevented).toBe(false);
    const input = screen.getByLabelText(/Radar smart search/i) as HTMLInputElement;
    expect(input).not.toHaveFocus();
  });

  it('runs the existing radar scan only when the Search button/Enter is used, not on every keystroke', async () => {
    await act(async () => {
      render(<RadarPanel />);
    });
    const input = (await screen.findByLabelText(/Radar smart search/i)) as HTMLInputElement;

    // Typing alone must NOT trigger a scan (no auto-search while typing).
    await userEvent.type(input, 'serendip');
    expect(chromeMock().runtime.sendMessage).not.toHaveBeenCalled();

    // Pressing Enter runs the scan with the typed query as the goal override.
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(
      () => expect(screen.getByText(/1 expression found for your goal/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );

    const calls = (chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const scanCall = calls.find((c) => c[0]?.type === 'radar:scan');
    expect(scanCall).toBeDefined();
    expect(scanCall![0].payload).toEqual({ goal: 'serendip' });
  });

  it('shows a visible Search button that submits the query', async () => {
    await act(async () => {
      render(<RadarPanel />);
    });
    const input = (await screen.findByLabelText(/Radar smart search/i)) as HTMLInputElement;

    // Search button is present but disabled until the query is long enough (MIN_QUERY_LENGTH = 2).
    const searchBtn = screen.getByRole('button', { name: /Search/i });
    expect(searchBtn).toBeDisabled();

    await userEvent.type(input, 'idempotent');
    expect(searchBtn).not.toBeDisabled();

    await userEvent.click(searchBtn);
    await waitFor(
      () => expect(screen.getByText(/1 expression found for your goal/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );
    const calls = (chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const scanCall = calls.find((c) => c[0]?.type === 'radar:scan');
    expect(scanCall![0].payload).toEqual({ goal: 'idempotent' });
  });

  it('shows a query-aware empty result instead of a generic "no content" message', async () => {
    seedSettings({ radar: { goal: '' } });
    // Return zero candidates so the scan resolves to the empty state.
    (chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (message: { type: string }) => {
        if (message.type === 'radar:scan') {
          return { ok: true, data: { candidates: [], chunksAnalyzed: 1, chunksTotal: 1, partial: false } };
        }
        return { ok: true, data: null };
      },
    );
    await act(async () => {
      render(<RadarPanel />);
    });
    const input = (await screen.findByLabelText(/Radar smart search/i)) as HTMLInputElement;
    await userEvent.type(input, 'dsfas');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(
      () => expect(screen.getByText(/No vocabulary found matching/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );
    expect(screen.getByText(/dsfas/)).toBeInTheDocument();
    expect(screen.queryByText(/enough readable content/i)).toBeNull();
  });

  it('clears the search query with Esc without destroying Radar state', async () => {
    await act(async () => {
      render(<RadarPanel />);
    });
    const input = (await screen.findByLabelText(/Radar smart search/i)) as HTMLInputElement;

    await userEvent.type(input, 'serendipity');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText(/1 expression found for your goal/i)).toBeInTheDocument(), {
      timeout: 2000,
    });
    expect(input).toHaveValue('serendipity');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
    // The previously fetched result stays visible (state preserved, not destroyed).
    expect(screen.getByText(/1 expression found for your goal/i)).toBeInTheDocument();
  });

  it('lets you search without a learning goal set (no blocking prompt)', async () => {
    seedSettings({ radar: { goal: '' } });
    await act(async () => {
      render(<RadarPanel />);
    });
    // The blocking "Set a learning goal in Settings to use Vocab Radar" prompt is gone.
    expect(screen.queryByText(/Set a learning goal in Settings to use Vocab Radar/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Find for my Radar/i })).toBeNull();

    const input = (await screen.findByLabelText(/Radar smart search/i)) as HTMLInputElement;
    await userEvent.type(input, 'idempotent');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(
      () => expect(screen.getByText(/1 expression found for your goal/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );
    const calls = (chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const scanCall = calls.find((c) => c[0]?.type === 'radar:scan');
    expect(scanCall![0].payload).toEqual({ goal: 'idempotent' });
  });
});
