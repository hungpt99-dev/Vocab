import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../../tailwind.config';
import { injectStyles } from '@/content/styles';
import { brand, color, layout, typography } from './tokens';

/**
 * The popup/options UI is styled by Tailwind, while the content script injects
 * a hand-built stylesheet (Tailwind is unavailable inside third-party pages).
 * These tests are the guard rail that keeps those two paths consistent and
 * enforces the "no hardcoded design values" rule from docs/DESIGN_SYSTEM.md.
 */
describe('design tokens', () => {
  it('feeds the Tailwind brand palette from the shared tokens', () => {
    expect(tailwindConfig.theme.extend.colors.brand).toBe(brand);
  });

  it('feeds the Tailwind font stack from the shared tokens', () => {
    expect(tailwindConfig.theme.extend.fontFamily.sans).toEqual([...typography.brandStack]);
  });

  it('exposes the popup widths asserted by the responsive E2E test', () => {
    expect(layout.popupMinWidth).toBe('320px');
  });

  it('injects a stylesheet built only from token values', () => {
    const doc = document.implementation.createHTMLDocument('test');
    injectStyles(doc);

    const css = doc.getElementById('avs-styles')?.textContent ?? '';
    expect(css).not.toBe('');

    // Every colour literal in the injected CSS must come from the token set.
    const known = new Set(
      [
        ...Object.values(brand),
        ...Object.values(color.slate),
        ...Object.values(color.status),
        '#fde68a', // DEFAULT_HIGHLIGHT_COLOR
      ].map((value) => value.toLowerCase()),
    );

    const used = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => match[0].toLowerCase());
    expect(used.length).toBeGreaterThan(0);
    expect([...new Set(used)].filter((value) => !known.has(value))).toEqual([]);
  });

  it('does not inject the stylesheet twice', () => {
    const doc = document.implementation.createHTMLDocument('test');
    injectStyles(doc);
    injectStyles(doc);
    expect(doc.querySelectorAll('#avs-styles')).toHaveLength(1);
  });
});
