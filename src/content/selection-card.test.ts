import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectionCard, type CardState } from './selection-card';
import { sendMessage } from '@/shared/messaging/client';

vi.mock('@/shared/messaging/client', () => ({
  sendMessage: vi.fn(),
}));

function makeState(text: string, unit: CardState['unit'] = 'word'): CardState {
  return {
    text,
    sentence: `Around "${text}" there is a sentence.`,
    sourceUrl: 'https://example.com',
    sourceTitle: 'Example',
    unit,
    rect: { top: 100, bottom: 114, left: 20, width: 50 },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('SelectionCard', () => {
  it('renders the word and a translation placeholder on show', () => {
    const card = new SelectionCard();
    card.show(makeState('serendipity'));
    const el = document.getElementById('avs-selection-card')!;
    expect(el.hidden).toBe(false);
    expect(el.querySelector('[data-role="word"]')?.textContent).toBe('serendipity');
    expect(el.querySelector('[data-role="translation"]')?.textContent).toBe('Translating…');
    card.destroy();
  });

  it('kicks off a keyless translation on show', () => {
    vi.mocked(sendMessage).mockResolvedValue('vận may mắn');
    const card = new SelectionCard();
    card.show(makeState('serendipity'));
    // translation resolves asynchronously
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const translation = document.querySelector('[data-role="translation"]')?.textContent;
        expect(translation).toBe('vận may mắn');
        card.destroy();
        resolve();
      }, 10);
    });
  });

  it('emits an action event with the selection text when a button is clicked', () => {
    const card = new SelectionCard();
    card.show(makeState('serendipity'));
    const handler = vi.fn();
    document.addEventListener('avs-toolbar-action', handler);
    document.querySelector<HTMLButtonElement>('[data-action="copy"]')!.click();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.objectContaining({ action: 'copy', text: 'serendipity' }) }),
    );
    card.destroy();
  });

  it('expands inline with the AI explanation when showExplain resolves', async () => {
    vi.mocked(sendMessage).mockImplementation((async (message: { type: string }) => {
      if (message.type === 'explain') {
        return {
          meaning: 'fortunate happenstance',
          translation: 'vận may mắn',
          examples: ['a serendipity'],
          synonyms: ['chance'],
          provider: 'openai',
          model: 'gpt-4o',
          generatedAt: Date.now(),
        };
      }
      return '';
    }) as unknown as typeof sendMessage);
    const card = new SelectionCard();
    await card.showExplain(makeState('serendipity'), 'word');
    const body = document.querySelector('.avs-selection-card-body')!;
    expect(body.classList.contains('avs-selection-card--expanded')).toBe(false);
    const text = body.textContent ?? '';
    expect(text).toContain('fortunate happenstance');
    expect(text).toContain('vận may mắn');
    card.destroy();
  });

  it('hides and detaches scroll handling', () => {
    const card = new SelectionCard();
    card.show(makeState('a'));
    expect(card.isVisible).toBe(true);
    card.hide();
    expect(card.isVisible).toBe(false);
    card.destroy();
    expect(document.querySelectorAll('#avs-selection-card')).toHaveLength(0);
  });

  it('does not show a stale explain result after opening another word', async () => {
    let resolveA!: (value: unknown) => void;
    vi.mocked(sendMessage).mockImplementation((async (message: { type: string }) => {
      if (message.type === 'explain') {
        // Word A's request resolves only after we open word B.
        return new Promise((resolve) => { resolveA = resolve; });
      }
      return '';
    }) as unknown as typeof sendMessage);

    const card = new SelectionCard();
    const a = makeState('serendipity');
    // Fire the explain for A but do NOT await — it stays pending until resolveA().
    void card.showExplain(a, 'word');
    // Body shows the loading state for A.
    expect(document.querySelector('.avs-selection-card-body')?.textContent).toContain('Asking the AI');

    // Now open a different word — this must clear the body and invalidate A's request.
    card.show(makeState('ephemeral'));
    expect(document.querySelector('[data-role="word"]')?.textContent).toBe('ephemeral');
    expect(document.querySelector('.avs-selection-card-body')?.textContent?.trim()).toBe('');

    // A's response finally resolves with A's data — must be dropped, not painted.
    resolveA({
      meaning: 'fortunate happenstance',
      translation: 'vận may mắn',
      examples: [],
      synonyms: [],
      provider: 'openai',
      model: 'gpt-4o',
      generatedAt: Date.now(),
    });
    await Promise.resolve();
    const body = document.querySelector('.avs-selection-card-body')!;
    expect(body.textContent ?? '').not.toContain('fortunate happenstance');
    expect(body.textContent ?? '').not.toContain('vận may mắn');
    card.destroy();
  });
});
