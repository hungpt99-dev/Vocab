import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../../tailwind.config';
import { injectStyles } from '@/content/styles';
import { brand, color, DEFAULT_HIGHLIGHT_COLOR, layout, typography } from './tokens';

/** Collect every hex-colour leaf value from a (possibly nested) token record. */
function flattenColors(record: Record<string, unknown>): string[] {
  return Object.values(record).flatMap((value) => {
    if (typeof value === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) return [value];
    if (typeof value === 'object' && value !== null) return flattenColors(value as Record<string, unknown>);
    return [];
  });
}

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
      [...flattenColors(brand), ...flattenColors(color), DEFAULT_HIGHLIGHT_COLOR].map((value) =>
        value.toLowerCase(),
      ),
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
