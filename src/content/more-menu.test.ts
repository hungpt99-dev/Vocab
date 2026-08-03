import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMenuPosition, MoreMenu } from './more-menu';

const anchor = document.createElement('button');

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('computeMenuPosition', () => {
  const menu = { width: 160, height: 40 };
  const viewport = { width: 1000, height: 800 };

  it('places the menu below the anchor, right-aligned to it', () => {
    const { top, left } = computeMenuPosition(
      { top: 200, bottom: 228, left: 100, right: 260 },
      menu,
      viewport,
    );
    expect(top).toBe(228 + 8);
    expect(left).toBe(260 - 160);
  });

  it('flips above the anchor when there is no room below', () => {
    const { top } = computeMenuPosition(
      { top: 760, bottom: 788, left: 100, right: 260 },
      menu,
      viewport,
    );
    expect(top).toBe(760 - 8 - 40);
  });

  it('clamps to the right viewport edge', () => {
    const { left } = computeMenuPosition(
      { top: 200, bottom: 228, left: 836, right: 996 },
      menu,
      viewport,
    );
    expect(left).toBe(1000 - 160 - 8);
  });

  it('clamps to the left viewport edge', () => {
    const { left } = computeMenuPosition(
      { top: 200, bottom: 228, left: -200, right: 40 },
      menu,
      viewport,
    );
    expect(left).toBe(8);
  });
});

describe('MoreMenu', () => {
  const items = [
    { label: 'Open settings', icon: '', run: vi.fn() },
    { label: 'Copy link', icon: '', run: vi.fn() },
  ];

  it('shows the menu anchored to the trigger and toggles it closed', () => {
    document.body.append(anchor);
    const menu = new MoreMenu();
    menu.toggle(anchor, items);

    const element = document.getElementById('avs-more-menu')!;
    expect(element.getAttribute('role')).toBe('menu');
    expect(element.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    expect(menu.isVisible).toBe(true);

    menu.toggle(anchor, items);
    expect(menu.isVisible).toBe(false);
    menu.destroy();
  });

  it('runs an item callback and closes the menu on click', () => {
    document.body.append(anchor);
    const menu = new MoreMenu();
    menu.show(anchor, items);

    document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1]!.click();
    expect(items[1]!.run).toHaveBeenCalledOnce();
    expect(menu.isVisible).toBe(false);
    menu.destroy();
  });

  it('hides on Escape', () => {
    document.body.append(anchor);
    const menu = new MoreMenu();
    menu.show(anchor, items);
    expect(menu.isVisible).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.isVisible).toBe(false);
    menu.destroy();
  });

  it('hides on outside mousedown but not on the trigger or inside the menu', () => {
    document.body.append(anchor);
    const menu = new MoreMenu();
    menu.show(anchor, items);

    anchor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu.isVisible).toBe(true);

    const element = document.getElementById('avs-more-menu')!;
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu.isVisible).toBe(true);

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu.isVisible).toBe(false);
    menu.destroy();
  });

  it('removes the menu element on destroy', () => {
    document.body.append(anchor);
    const menu = new MoreMenu();
    menu.show(anchor, items);
    menu.destroy();
    expect(document.querySelectorAll('.avs-menu')).toHaveLength(0);
  });
});
