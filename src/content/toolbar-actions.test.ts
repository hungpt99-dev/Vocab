import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleToolbarAction, type ToolbarActionDeps } from './toolbar-actions';
import { chromeMock } from '@/test/chrome-mock';
import type { Explanation, VocabularyEntry } from '@/shared/types/vocabulary';
import type { SelectionPopover } from './selection-popover';
import type { MoreMenu } from './more-menu';

const explanation: Explanation = {
  meaning: 'A fortunate accident.',
  simpleExplanation: 'Good luck.',
  translation: '巧合',
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

const entry: VocabularyEntry = {
  id: '1',
  word: 'serendipity',
  wordKey: 'serendipity',
  phrase: '',
  sentence: 'Pure serendipity.',
  sourceUrl: 'https://example.com',
  sourceTitle: 'Example',
  note: '',
  tags: [],
  favorite: false,
  sourceLanguage: 'en',
  explanation: null,
  createdAt: 1,
  updatedAt: 1,
};

function makeDeps() {
  const anchor = document.createElement('button');
  const deps: ToolbarActionDeps = {
    getAnchor: () => ({ top: 0, bottom: 0, left: 0, width: 0 }),
    getMoreButton: () => anchor,
    popover: { show: vi.fn(async () => undefined), hide: vi.fn() } as unknown as SelectionPopover,
    menu: { toggle: vi.fn() } as unknown as MoreMenu,
    hideToolbar: vi.fn(),
  };
  return { deps, anchor };
}

/** The chrome mock's sendMessage is typed narrowly; tests set arbitrary results. */
function sendMessageMock(): ReturnType<typeof vi.fn> {
  return chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('handleToolbarAction — copy', () => {
  it('writes the selection to the clipboard and hides the toolbar', async () => {
    const { deps } = makeDeps();
    await handleToolbarAction('copy', 'serendipity', deps);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('serendipity');
    expect(deps.hideToolbar).toHaveBeenCalled();
    expect(document.querySelector('.avs-toast')?.textContent).toBe('Copied to clipboard');
  });

  it('reports a clipboard failure', async () => {
    const { deps } = makeDeps();
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('denied'),
    );

    await handleToolbarAction('copy', 'serendipity', deps);
    expect(document.querySelector('.avs-toast')?.textContent).toBe('Could not copy');
    expect(deps.hideToolbar).toHaveBeenCalled();
  });
});

describe('handleToolbarAction — save', () => {
  it('routes to the save-current-selection handler and confirms', async () => {
    const { deps } = makeDeps();
    sendMessageMock().mockResolvedValue({ ok: true, data: entry });

    await handleToolbarAction('save', 'serendipity', deps);

    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: 'save-current-selection',
    });
    expect(document.querySelector('.avs-toast')?.textContent).toBe(
      'Saved "serendipity" to your vocabulary.',
    );
    expect(deps.hideToolbar).toHaveBeenCalled();
  });

  it('warns when nothing is selected', async () => {
    const { deps } = makeDeps();
    sendMessageMock().mockResolvedValue({ ok: true, data: null });

    await handleToolbarAction('save', '', deps);
    expect(document.querySelector('.avs-toast')?.textContent).toBe('No selection to save.');
  });

  it('surfaces a background error', async () => {
    const { deps } = makeDeps();
    sendMessageMock().mockResolvedValue({ ok: false, error: 'Could not save that word.' });

    await handleToolbarAction('save', 'serendipity', deps);
    expect(document.querySelector('.avs-toast')?.textContent).toBe('Could not save that word.');
  });
});

describe('handleToolbarAction — explain / translate', () => {
  it('routes explain through the bus and opens the popover with an Explanation', async () => {
    const { deps } = makeDeps();
    sendMessageMock().mockResolvedValue({ ok: true, data: explanation });

    await handleToolbarAction('explain', 'serendipity', deps);

    expect(deps.popover.show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Explain' }));

    const options = (deps.popover.show as ReturnType<typeof vi.fn>).mock.calls[0]![0]!;
    await expect(options.load()).resolves.toEqual({ kind: 'explain', explanation });
    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: 'explain',
      payload: { word: 'serendipity' },
    });
  });

  it('routes translate through the bus and opens the popover with the translation', async () => {
    const { deps } = makeDeps();
    sendMessageMock().mockResolvedValue({ ok: true, data: '巧合' });

    await handleToolbarAction('translate', 'luck', deps);

    expect(deps.popover.show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Translate' }));

    const options = (deps.popover.show as ReturnType<typeof vi.fn>).mock.calls[0]![0]!;
    await expect(options.load()).resolves.toEqual({ kind: 'translate', translation: '巧合' });
    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: 'translate',
      payload: { text: 'luck' },
    });
  });

  it('hides the toolbar before opening the popover', async () => {
    const { deps } = makeDeps();
    sendMessageMock().mockResolvedValue({ ok: true, data: explanation });

    await handleToolbarAction('explain', 'serendipity', deps);
    const hideOrder = (deps.hideToolbar as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const showOrder = (deps.popover.show as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(hideOrder!).toBeLessThan(showOrder!);
  });
});

describe('handleToolbarAction — more', () => {
  it('opens the menu anchored to the More button', async () => {
    const { deps, anchor } = makeDeps();
    await handleToolbarAction('more', 'serendipity', deps);

    expect(deps.menu.toggle).toHaveBeenCalledWith(anchor, expect.any(Array));
  });

  it('opens the options page when the menu item runs', async () => {
    const { deps } = makeDeps();
    sendMessageMock().mockResolvedValue({ ok: true, data: undefined });

    await handleToolbarAction('more', 'serendipity', deps);
    const items = (deps.menu.toggle as ReturnType<typeof vi.fn>).mock.calls[0]![1]!;
    items[0].run();

    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({ type: 'open-options' });
    expect(deps.hideToolbar).toHaveBeenCalled();
  });
});
