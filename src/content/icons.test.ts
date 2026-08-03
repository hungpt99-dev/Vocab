import { describe, expect, it } from 'vitest';
import {
  icon,
  ICON_BOOK,
  ICON_BOOKMARK,
  ICON_BOOK_OPEN,
  ICON_CLOSE,
  ICON_COPY,
  ICON_FILE,
  ICON_LANGUAGES,
  ICON_MESSAGE,
  ICON_MINIMIZE,
  ICON_MORE,
  ICON_SETTINGS,
  ICON_SPARKLES,
} from './icons';

describe('icon()', () => {
  it('wraps a lucide-static source at the overlays fixed 16x16 size', () => {
    const rendered = icon(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M2 3h6z"/></svg>',
    );
    expect(rendered).toMatch(/^<svg viewBox="0 0 24 24" width="16" height="16"/);
    expect(rendered).toContain('aria-hidden="true"');
    expect(rendered).toContain('<path d="M2 3h6z"/>');
    expect(rendered).toMatch(/<\/svg>$/);
  });

  it('strips the lucide class so it never leaks into the host page', () => {
    const rendered = icon(
      '<svg class="lucide lucide-sparkles" width="24" height="24"><path d="M2 3h6z"/></svg>',
    );
    expect(rendered).not.toContain('class="lucide');
    expect(rendered).not.toContain('lucide-sparkles');
    expect(rendered).not.toContain('width="24"');
  });

  it('emits one compact svg per exported constant', () => {
    const constants = [
      ICON_SPARKLES,
      ICON_LANGUAGES,
      ICON_BOOKMARK,
      ICON_COPY,
      ICON_MORE,
      ICON_CLOSE,
      ICON_SETTINGS,
      ICON_BOOK_OPEN,
      ICON_MESSAGE,
      ICON_BOOK,
      ICON_MINIMIZE,
      ICON_FILE,
    ];
    for (const constant of constants) {
      expect(constant).toMatch(/^<svg viewBox="0 0 24 24" width="16" height="16"/);
      expect(constant).toMatch(/<\/svg>$/);
      expect(constant).not.toContain('class="lucide');
    }
  });
});
