import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Explanation } from '@/shared/types/vocabulary';
import { ExplainPopover, type ExplainPopoverState } from './explain-popover';

const rect = { top: 100, bottom: 114, left: 20, width: 50 };

const explanation: Explanation = {
  meaning: 'The quality of finding good things by chance.',
  simpleExplanation: 'A lucky discovery.',
  translation: 'Serendipidad',
  examples: ['Their meeting was pure serendipity.'],
  synonyms: ['chance', 'luck'],
  antonyms: ['design'],
  relatedWords: ['coincidence', 'fate'],
  pronunciation: '/ˌser.ənˈdɪp.ə.ti/',
  collocations: ['pure serendipity', 'by serendipity'],
  grammar: 'noun, uncountable',
  provider: 'openai',
  model: 'gpt-4o-mini',
  generatedAt: 0,
};

const state: ExplainPopoverState = { text: 'serendipity', mode: 'explain', rect };

function setup(
  overrides: Partial<{
    load: (t: string) => Promise<Explanation>;
    onSave: (t: string) => Promise<void>;
  }> = {},
) {
  const load = vi.fn(
    overrides.load ?? (async (text: string) => ({ ...explanation, generatedAt: text.length })),
  );
  const onSave = vi.fn(overrides.onSave ?? (async () => undefined));
  const popover = new ExplainPopover({ load, onSave });
  return { popover, load, onSave };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('ExplainPopover', () => {
  it('renders a loading state and then the explanation', async () => {
    const { popover, load } = setup();
    popover.show(state);

    const element = document.getElementById('avs-explain-popover')!;
    expect(element.hidden).toBe(false);
    expect(element.getAttribute('role')).toBe('dialog');
    expect(element.querySelector('.avs-popover-status')?.textContent).toBe('Asking your AI…');
    expect(load).toHaveBeenCalledWith('serendipity');

    await vi.waitFor(() => {
      expect(element.querySelector('.avs-popover-section')).not.toBeNull();
    });

    const text = element.textContent ?? '';
    expect(text).toContain('Meaning');
    expect(text).toContain('The quality of finding good things by chance.');
    expect(text).toContain('Serendipidad');
    expect(text).toContain('pure serendipity');
    expect(element.querySelector('.avs-popover-meta')?.textContent).toBe('openai · gpt-4o-mini');
    popover.destroy();
  });

  it('skips empty explanation fields', async () => {
    const { popover } = setup({
      load: async () => ({
        ...explanation,
        translation: '',
        antonyms: [],
        pronunciation: '',
      }),
    });
    popover.show(state);
    const element = document.getElementById('avs-explain-popover')!;
    await vi.waitFor(() => {
      expect(element.querySelector('.avs-popover-section')).not.toBeNull();
    });
    const text = element.textContent ?? '';
    expect(text).not.toContain('Antonyms');
    expect(text).not.toContain('Pronunciation');
    expect(text).not.toContain('Translation');
    popover.destroy();
  });

  it('renders only the translation in translate mode', async () => {
    const { popover } = setup();
    popover.show({ ...state, mode: 'translate' });
    const element = document.getElementById('avs-explain-popover')!;
    await vi.waitFor(() => {
      expect(element.querySelector('.avs-popover-translation')).not.toBeNull();
    });
    expect(element.querySelector('.avs-popover-translation')?.textContent).toBe('Serendipidad');
    expect(element.textContent).not.toContain('Meaning');
    popover.destroy();
  });

  it('shows the error message and retries on request failure', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('missing_api_key'))
      .mockResolvedValueOnce(explanation);
    const { popover } = setup({ load });
    popover.show(state);
    const element = document.getElementById('avs-explain-popover')!;

    await vi.waitFor(() => {
      expect(element.querySelector('.avs-popover-error')?.textContent).toBe('missing_api_key');
    });
    expect(load).toHaveBeenCalledTimes(1);

    element.querySelector<HTMLButtonElement>('.avs-popover-retry')!.click();
    await vi.waitFor(() => {
      expect(element.querySelector('.avs-popover-section')).not.toBeNull();
    });
    expect(load).toHaveBeenCalledTimes(2);
    popover.destroy();
  });

  it('saves the selection via the callback and hides on success', async () => {
    const { popover, onSave } = setup();
    popover.show(state);
    const element = document.getElementById('avs-explain-popover')!;
    element.querySelector<HTMLButtonElement>('.avs-popover-save')!.click();

    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('serendipity');
    });
    expect(popover.isVisible).toBe(false);
    popover.destroy();
  });

  it('stays open when saving fails', async () => {
    const { popover, onSave } = setup({ onSave: async () => Promise.reject(new Error('boom')) });
    popover.show(state);
    const element = document.getElementById('avs-explain-popover')!;
    element.querySelector<HTMLButtonElement>('.avs-popover-save')!.click();

    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
    expect(popover.isVisible).toBe(true);
    popover.destroy();
  });

  it('hides on close, and ignores a stale response after hiding', async () => {
    let resolveLoad: (value: Explanation) => void = () => undefined;
    const { popover } = setup({
      load: () =>
        new Promise<Explanation>((resolve) => {
          resolveLoad = resolve;
        }),
    });
    popover.show(state);
    const element = document.getElementById('avs-explain-popover')!;
    popover.hide();
    expect(popover.isVisible).toBe(false);

    resolveLoad(explanation);
    await Promise.resolve();
    expect(element.querySelector('.avs-popover-section')).toBeNull();
    expect(popover.isVisible).toBe(false);
    popover.destroy();
  });
});
