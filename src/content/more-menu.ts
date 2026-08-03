const MENU_ID = 'avs-more-menu';
const OFFSET = 8;

export interface MoreMenuItem {
  label: string;
  icon: string;
  run: () => void;
}

/**
 * Compute a viewport-clamped position placing the menu below the anchor,
 * right-aligned to it (the conventional trigger alignment).
 */
export function computeMenuPosition(
  anchor: { top: number; bottom: number; left: number; right: number },
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const fitsBelow = anchor.bottom + OFFSET + menu.height <= viewport.height;
  const top = fitsBelow
    ? anchor.bottom + OFFSET
    : Math.max(OFFSET, anchor.top - OFFSET - menu.height);
  const left = Math.min(
    Math.max(OFFSET, anchor.right - menu.width),
    Math.max(OFFSET, viewport.width - menu.width - OFFSET),
  );
  return { top, left };
}

/**
 * Dropdown menu anchored to the toolbar's "More" button. Pure DOM so it can
 * live in the content-script IIFE. Each item runs a callback and closes the
 * menu; the menu is dismissed with Escape, outside click or a second click on
 * its trigger.
 */
export class MoreMenu {
  private element: HTMLElement | null = null;
  private anchor: HTMLElement | null = null;

  private readonly keydownHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.hide();
  };

  private readonly outsideHandler = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof Node && this.element?.contains(target)) return;
    if (target instanceof Node && this.anchor?.contains(target)) return;
    this.hide();
  };

  toggle(anchor: HTMLElement, items: MoreMenuItem[]): void {
    if (this.isVisible) {
      this.hide();
      return;
    }
    this.show(anchor, items);
  }

  show(anchor: HTMLElement, items: MoreMenuItem[]): void {
    const menu = this.ensureElement();
    this.anchor = anchor;
    menu.hidden = false;
    menu.replaceChildren(...items.map((item) => this.buildItem(item)));
    this.position(menu, anchor);

    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('mousedown', this.outsideHandler);
  }

  hide(): void {
    if (this.element) this.element.hidden = true;
    this.anchor = null;
    document.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('mousedown', this.outsideHandler);
  }

  get isVisible(): boolean {
    return !!this.element?.isConnected && !this.element.hidden;
  }

  destroy(): void {
    this.hide();
    this.element?.remove();
    this.element = null;
  }

  private ensureElement(): HTMLElement {
    if (this.element?.isConnected) return this.element;

    const menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'avs-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'More actions');
    menu.hidden = true;
    document.body.append(menu);
    this.element = menu;
    return menu;
  }

  private buildItem(item: MoreMenuItem): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'avs-menu-item';
    button.setAttribute('role', 'menuitem');
    button.innerHTML = `${item.icon}<span>${item.label}</span>`;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      item.run();
      this.hide();
    });
    return button;
  }

  private position(menu: HTMLElement, anchor: HTMLElement): void {
    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const { top, left } = computeMenuPosition(
      anchorRect,
      { width: menuRect.width, height: menuRect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }
}
