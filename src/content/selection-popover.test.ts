import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computePopoverPosition, SelectionPopover } from './selection-popover';
import type { Explanation } from '@/shared/types/vocabulary';

const explanation: Explanation = {
  meaning: 'A fortunate accident.',
  simpleExplanation: 'Good luck.',
  translation: '巧合',
  examples: ['Meeting her was pure serendipity.'],
  synonyms: ['chance', 'luck'],
  antonyms: [],
  relatedWords: [],
  pronunciation: '/ˌserənˈdɪpəti/',
  collocations: [],
  grammar: '',
  provider: 'openai',
  model: 'gpt-4o-mini',
  generatedAt: 1,
};

const anchor = { top: 200, bottom: 214, left: 100, width: 100 };

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('computePopoverPosition', () => {
  const popover = { width: 260, height: 180 };
  const viewport = { width: 1000, height: 800 };

  it('places the popover below the anchor, left-aligned to it', () => {
    const { top, left } = computePopoverPosition(
      { top: 200, bottom: 214, left: 100, width: 100 },
      popover,
      viewport,
    );
    expect(top).toBe(214 + 8);
    expect(left).toBe(100);
  });

  it('flips above the anchor when there is no room below', () => {
    const { top } = computePopoverPosition(
      { top: 700, bottom: 714, left: 100, width: 100 },
      popover,
      viewport,
    );
    expect(top).toBe(700 - 8 - 180);
  });

  it('clamps to the right viewport edge', () => {
    const { left } = computePopoverPosition(
      { top: 200, bottom: 214, left: 900, width: 100 },
      popover,
      viewport,
    );
    expect(left).toBe(1000 - 260 - 8);
  });

  it('clamps to the left viewport edge', () => {
    const { left } = computePopoverPosition(
      { top: 200, bottom: 214, left: -100, width: 100 },
      popover,
      viewport,
    );
    expect(left).toBe(8);
  });
});

describe('SelectionPopover', () => {
  it('shows a loading status and then the explanation', async () => {
    const popover = new SelectionPopover();
    const load = vi.fn(async () => ({ kind: 'explain' as const, explanation }));

    const promise = popover.show({ title: 'Explain', load, anchor });
    const element = document.getElementById('avs-popover')!;
    expect(element.getAttribute('role')).toBe('dialog');
    expect(element.querySelector('.avs-popover-status')?.textContent).toBe('Explain…');

    await promise;
    expect(element.querySelector('.avs-popover-meaning')?.textContent).toBe(
      'A fortunate accident.',
    );
    expect(element.querySelector('.avs-popover-pronunciation')?.textContent).toBe(
      '/ˌserənˈdɪpəti/',
    );
    expect(element.textContent).toContain('Examples');
    expect(element.textContent).toContain('Meeting her was pure serendipity.');
    expect(element.querySelector('.avs-popover-close')).not.toBeNull();
    popover.destroy();
  });

  it('renders a translation result', async () => {
    const popover = new SelectionPopover();
    await popover.show({
      title: 'Translate',
      load: async () => ({ kind: 'translate' as const, translation: '巧合' }),
      anchor,
    });

    const element = document.getElementById('avs-popover')!;
    expect(element.querySelector('.avs-popover-body')?.textContent).toBe('巧合');
    popover.destroy();
  });

  it('surfaces an error message with role alert', async () => {
    const popover = new SelectionPopover();
    await popover.show({
      title: 'Explain',
      load: async () => {
        throw new Error('missing_api_key');
      },
      anchor,
    });

    const element = document.getElementById('avs-popover')!;
    expect(element.querySelector('.avs-popover-error')).toHaveAttribute('role', 'alert');
    expect(element.querySelector('.avs-popover-error')?.textContent).toBe('missing_api_key');
    popover.destroy();
  });

  it('hides on Escape', async () => {
    const popover = new SelectionPopover();
    await popover.show({
      title: 'Explain',
      load: async () => ({ kind: 'explain' as const, explanation }),
      anchor,
    });
    expect(popover.isVisible).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popover.isVisible).toBe(false);
    popover.destroy();
  });

  it('hides on outside mousedown but not on mousedown inside the popover', async () => {
    const popover = new SelectionPopover();
    await popover.show({
      title: 'Explain',
      load: async () => ({ kind: 'explain' as const, explanation }),
      anchor,
    });

    const element = document.getElementById('avs-popover')!;
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(popover.isVisible).toBe(true);

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(popover.isVisible).toBe(false);
    popover.destroy();
  });

  it('hides when the close button is clicked', async () => {
    const popover = new SelectionPopover();
    await popover.show({
      title: 'Explain',
      load: async () => ({ kind: 'explain' as const, explanation }),
      anchor,
    });

    document.querySelector<HTMLButtonElement>('.avs-popover-close')!.click();
    expect(popover.isVisible).toBe(false);
    popover.destroy();
  });

  it('stays hidden when dismissed while the request is in flight', async () => {
    const popover = new SelectionPopover();
    let resolveLoad!: (value: { kind: 'explain'; explanation: Explanation }) => void;
    const load = () =>
      new Promise<{ kind: 'explain'; explanation: Explanation }>((resolve) => {
        resolveLoad = resolve;
      });

    const promise = popover.show({ title: 'Explain', load, anchor });
    popover.hide();
    resolveLoad({ kind: 'explain', explanation });
    await promise;

    expect(document.getElementById('avs-popover')?.hidden).toBe(true);
    popover.destroy();
  });
});
