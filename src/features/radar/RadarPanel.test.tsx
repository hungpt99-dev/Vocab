import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadarPanel } from './RadarPanel';
import { chromeMock } from '@/test/chrome-mock';
import { DEFAULT_SETTINGS } from '@/storage/settings-repository';
import type { RadarEntryView } from './types';

function seedSettings(overrides: Record<string, unknown> = {}): void {
  const settings = {
    ...DEFAULT_SETTINGS,
    providers: [{ id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'sk-x', enabled: true }],
    activeProviderId: 'p1',
    radar: { enabled: true },
    ...overrides,
  };
  void chromeMock().storage.local.set({ 'avs:settings': settings });
}

/** Mock the background `radar:list` response for the panel. */
function seedRadarList(items: RadarEntryView[]): void {
  chromeMock().runtime.sendMessage.mockImplementation(async (message: { type: string }) => {
    if (message.type === 'radar:list') return { ok: true, data: items };
    return { ok: true, data: null };
  });
}

const SAMPLE_ITEMS: RadarEntryView[] = [
  {
    id: 'r1',
    word: 'alleviate',
    wordKey: 'alleviate',
    normalizedForm: 'alleviate',
    lemma: 'alleviate',
    familyId: 'alleviate',
    phrase: '',
    userId: 'u1',
    sourceIds: ['s1'],
    relationship: 'synonym',
    reason: 'A direct synonym of mitigate.',
    createdAt: 1,
    updatedAt: 1,
    sourceWords: ['mitigate'],
  },
  {
    id: 'r2',
    word: 'counteract',
    wordKey: 'counteract',
    normalizedForm: 'counteract',
    lemma: 'counteract',
    familyId: 'counteract',
    phrase: '',
    userId: 'u1',
    sourceIds: ['s1'],
    relationship: 'antonym',
    reason: 'The opposite of mitigate.',
    createdAt: 2,
    updatedAt: 2,
    sourceWords: ['mitigate'],
  },
];

describe('RadarPanel — local list', () => {
  beforeEach(() => {
    seedSettings();
    chromeMock().runtime.sendMessage.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an empty state when there are no Radar words', async () => {
    seedRadarList([]);
    await act(async () => {
      render(<RadarPanel />);
    });
    await waitFor(() => expect(screen.getByText(/No Radar words yet/i)).toBeInTheDocument());
  });

  it('lists Radar words with their source relationship', async () => {
    seedRadarList(SAMPLE_ITEMS);
    await act(async () => {
      render(<RadarPanel />);
    });
    expect(screen.getByText('alleviate')).toBeInTheDocument();
    expect(screen.getByText('counteract')).toBeInTheDocument();
    expect(screen.getAllByText(/Related to: mitigate/i)).toHaveLength(2);
  });

  it('filters the list locally without calling AI (no radar:scan / explain)', async () => {
    seedRadarList(SAMPLE_ITEMS);
    await act(async () => {
      render(<RadarPanel />);
    });
    const input = (await screen.findByLabelText(/Search radar words/i)) as HTMLInputElement;

    await userEvent.type(input, 'allev');
    await waitFor(() => expect(screen.queryByText('counteract')).not.toBeInTheDocument());
    expect(screen.getByText('alleviate')).toBeInTheDocument();

    // Local search must not trigger any AI-backed message.
    const calls = (chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => c[0]?.type === 'radar:scan')).toBe(false);
    expect(calls.some((c) => c[0]?.type === 'explain')).toBe(false);
  });

  it('Save moves a Radar word into Saved Vocabulary (radar:save) and refreshes', async () => {
    let listAfter = SAMPLE_ITEMS;
    chromeMock().runtime.sendMessage.mockImplementation(async (message: { type: string; payload?: unknown }) => {
      if (message.type === 'radar:list') return { ok: true, data: listAfter };
      if (message.type === 'radar:save') {
        listAfter = listAfter.filter((i) => i.wordKey !== (message.payload as { wordKey: string }).wordKey);
        return { ok: true, data: { id: 'new', word: 'alleviate' } };
      }
      return { ok: true, data: null };
    });

    await act(async () => {
      render(<RadarPanel />);
    });
    const saveButtons = await screen.findAllByRole('button', { name: 'Save' });
    await userEvent.click(saveButtons[0]!);

    await waitFor(() => expect(screen.queryByText('alleviate')).not.toBeInTheDocument());
    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: 'radar:save',
      payload: { word: 'alleviate', wordKey: 'alleviate', sourceLanguage: '' },
    });
  });

  it('Remove deletes a Radar word (radar:remove)', async () => {
    chromeMock().runtime.sendMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'radar:list') return { ok: true, data: SAMPLE_ITEMS };
      return { ok: true, data: null };
    });
    await act(async () => {
      render(<RadarPanel />);
    });
    const removeBtn = await screen.findByRole('button', { name: /Remove alleviate/i });
    await userEvent.click(removeBtn);
    await waitFor(() =>
      expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({
        type: 'radar:remove',
        payload: { wordKey: 'alleviate' },
      }),
    );
  });
});
