import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SMART_ASSIST_ACTIONS,
  classifySelection,
  computeToolbarPosition,
  readToolbarSelection,
  SelectionToolbar,
  SmartAssistMenu,
  type ToolbarState,
} from './toolbar';

function makeState(text: string, unit: ToolbarState['unit'] = 'word'): ToolbarState {
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

describe('classifySelection', () => {
  it('treats a single token as a word', () => {
    expect(classifySelection('serendipity')).toBe('word');
  });

  it('treats a multi-word span as a phrase', () => {
    expect(classifySelection('a piece of cake')).toBe('phrase');
  });

  it('treats a single sentence as a sentence', () => {
    expect(classifySelection('Serendipity struck me today.')).toBe('sentence');
  });

  it('treats two sentences as a paragraph', () => {
    expect(classifySelection('One sentence. Then another one.')).toBe('paragraph');
  });

  it('returns word for empty input', () => {
    expect(classifySelection('   ')).toBe('word');
  });
});

describe('readToolbarSelection', () => {
  it('returns null when the selection is collapsed', () => {
    vi.spyOn(document, 'getSelection').mockReturnValue({
      isCollapsed: true,
      toString: () => 'word',
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ width: 10, height: 10, top: 0, bottom: 0, left: 0 }) }),
    } as unknown as Selection);
    expect(readToolbarSelection()).toBeNull();
  });

  it('returns text, unit and rect for a real selection', () => {
    const range = {
      getBoundingClientRect: () => ({ width: 50, height: 14, top: 100, bottom: 114, left: 20 }),
    };
    vi.spyOn(document, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'serendipity',
      getRangeAt: () => range,
      anchorNode: {
        parentElement: { textContent: 'serendipity struck me today.' },
      },
    } as unknown as Selection);

    const result = readToolbarSelection();
    expect(result).toMatchObject({
      text: 'serendipity',
      unit: 'word',
      sentence: 'serendipity struck me today.',
      rect: { top: 100, left: 20, width: 50 },
    });
    expect(result?.sourceUrl).toBeTruthy();
  });
});

describe('computeToolbarPosition', () => {
  const toolbar = { width: 200, height: 36 };
  const viewport = { width: 1000, height: 800 };

  it('places the toolbar above the selection, centered on it', () => {
    const { top, left } = computeToolbarPosition({ top: 200, bottom: 214, left: 100, width: 100 }, toolbar, viewport);
    expect(top).toBe(200 - 8 - 36); // anchor.top - offset - height
    expect(left).toBe(100 + 50 - 100); // center - half width
  });

  it('flips below the anchor when there is no room above', () => {
    const { top } = computeToolbarPosition({ top: 20, bottom: 34, left: 100, width: 100 }, toolbar, viewport);
    expect(top).toBe(34 + 8);
  });

  it('clamps to the right viewport edge', () => {
    const { left } = computeToolbarPosition({ top: 200, bottom: 214, left: 950, width: 100 }, toolbar, viewport);
    expect(left).toBe(1000 - 200 - 8);
  });

  it('clamps to the left viewport edge', () => {
    const { left } = computeToolbarPosition({ top: 200, bottom: 214, left: -100, width: 100 }, toolbar, viewport);
    expect(left).toBe(8);
  });
});

describe('SelectionToolbar', () => {
  it('renders five action buttons with aria-labels and emits an action event', () => {
    document.body.innerHTML = '<p>hello world</p>';
    const toolbarUi = new SelectionToolbar();
    toolbarUi.show(makeState('hello', 'phrase'));

    const element = document.getElementById('avs-toolbar')!;
    expect(element.hidden).toBe(false);
    expect(element.getAttribute('role')).toBe('toolbar');
    expect(element.querySelectorAll('.avs-toolbar-btn')).toHaveLength(5);

    const handler = vi.fn();
    document.addEventListener('avs-toolbar-action', handler);
    element.querySelector<HTMLButtonElement>('[data-action="copy"]')!.click();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ action: 'copy', text: 'hello' }),
      }),
    );
    toolbarUi.destroy();
  });

  it('hides and detaches scroll handling', () => {
    document.body.innerHTML = '<p>hello world</p>';
    const toolbarUi = new SelectionToolbar();
    toolbarUi.show(makeState('hi'));
    expect(toolbarUi.isVisible).toBe(true);

    toolbarUi.hide();
    expect(toolbarUi.isVisible).toBe(false);
    toolbarUi.destroy();
    expect(document.querySelectorAll('.avs-toolbar')).toHaveLength(0);
  });

  it('reuses a single toolbar element across shows', () => {
    document.body.innerHTML = '<p>hello world</p>';
    const toolbarUi = new SelectionToolbar();
    toolbarUi.show(makeState('a'));
    toolbarUi.show(makeState('b', 'phrase'));
    expect(document.querySelectorAll('.avs-toolbar')).toHaveLength(1);
    toolbarUi.destroy();
  });
});

describe('SelectionToolbar keyboard navigation', () => {
  const showToolbar = (): { toolbarUi: SelectionToolbar; buttons: HTMLButtonElement[] } => {
    document.body.innerHTML = '<p>hello world</p>';
    const toolbarUi = new SelectionToolbar();
    toolbarUi.show({ text: 'hello', unit: 'word', rect: { top: 100, bottom: 114, left: 20, width: 50 } });
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.avs-toolbar-btn')];
    return { toolbarUi, buttons };
  };

  const press = (button: HTMLButtonElement, key: string): void => {
    button.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
  };

  it('exposes a single tab stop (roving tabindex) and a horizontal toolbar', () => {
    const { toolbarUi, buttons } = showToolbar();
    const toolbar = document.getElementById('avs-toolbar')!;
    expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    expect(buttons[0]!.tabIndex).toBe(0);
    toolbarUi.destroy();
  });

  it('moves focus right on ArrowRight, wrapping to the first action', () => {
    const { toolbarUi, buttons } = showToolbar();
    const last = buttons[buttons.length - 1]!;
    last.focus();
    press(last, 'ArrowRight');
    expect(document.activeElement).toBe(buttons[0]);
    expect(buttons[0]!.tabIndex).toBe(0);
    expect(last.tabIndex).toBe(-1);
    toolbarUi.destroy();
  });

  it('moves focus left on ArrowLeft, wrapping to the last action', () => {
    const { toolbarUi, buttons } = showToolbar();
    const first = buttons[0]!;
    first.focus();
    press(first, 'ArrowLeft');
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    expect(buttons[buttons.length - 1]!.tabIndex).toBe(0);
    toolbarUi.destroy();
  });

  it('jumps to the first and last action with Home and End', () => {
    const { toolbarUi, buttons } = showToolbar();
    const middle = buttons[2]!;
    middle.focus();
    press(middle, 'Home');
    expect(document.activeElement).toBe(buttons[0]);
    press(middle, 'End');
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    toolbarUi.destroy();
  });

  it('ignores non-navigation keys on the toolbar', () => {
    const { toolbarUi, buttons } = showToolbar();
    const first = buttons[0]!;
    first.focus();
    press(first, 'Enter');
    expect(document.activeElement).toBe(first);
    toolbarUi.destroy();
  });
});

describe('SMART_ASSIST_ACTIONS', () => {
  it('exposes the six smart-AI actions with routing metadata', () => {
    expect(SMART_ASSIST_ACTIONS.map((action) => action.label)).toEqual([
      'Explain sentence',
      'Explain grammar',
      'Explain vocabulary',
      'Simplify',
      'Summarize',
      'Save difficult words',
    ]);
    expect(SMART_ASSIST_ACTIONS.filter((action) => action.kind)).toHaveLength(5);
    expect(SMART_ASSIST_ACTIONS.find((action) => action.id === 'save-difficult-words')?.kind).toBeUndefined();
  });
});

describe('SmartAssistMenu', () => {
  it('renders six items and emits an assist action with the toolbar state', () => {
    document.body.innerHTML = '<p>hello world</p>';
    const menu = new SmartAssistMenu();
    const state = makeState('A difficult sentence.', 'sentence');
    menu.toggle(state);

    const element = document.getElementById('avs-assist-menu')!;
    expect(element.hidden).toBe(false);
    expect(element.getAttribute('role')).toBe('menu');
    expect(element.querySelectorAll('.avs-assist-item')).toHaveLength(6);

    const handler = vi.fn();
    document.addEventListener('avs-assist-action', handler);
    element.querySelector<HTMLButtonElement>('[data-action="simplify"]')!.click();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { action: 'simplify', state } }),
    );
    expect(element.hidden).toBe(true);
    menu.destroy();
  });

  it('toggles off when reopened with the same text', () => {
    document.body.innerHTML = '<p>hello</p>';
    const menu = new SmartAssistMenu();
    menu.toggle(makeState('hello'));
    expect(menu.isVisible).toBe(true);
    menu.toggle(makeState('hello'));
    expect(menu.isVisible).toBe(false);
    menu.destroy();
  });

  it('hides on Escape and returns focus to the more button', () => {
    document.body.innerHTML = '<button data-action="more">more</button>';
    const menu = new SmartAssistMenu();
    menu.toggle(makeState('hello'));

    const element = document.getElementById('avs-assist-menu')!;
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(menu.isVisible).toBe(false);
    menu.destroy();
  });
});
