import { beforeEach, describe, expect, it } from 'vitest';
import { applyHighlightColor, HIGHLIGHT_COLOR_VAR, injectStyles } from './styles';

const injectedCss = (): string => {
  const style = document.getElementById('avs-styles');
  if (!style) throw new Error('styles not injected');
  return style.textContent ?? '';
};

beforeEach(() => {
  document.getElementById('avs-styles')?.remove();
  document.documentElement.removeAttribute('style');
});

describe('injectStyles', () => {
  it('injects the stylesheet exactly once', () => {
    injectStyles();
    injectStyles();
    expect(document.querySelectorAll('#avs-styles')).toHaveLength(1);
  });

  it('themed overlays through prefers-color-scheme custom properties', () => {
    injectStyles();
    const css = injectedCss();
    expect(css).toContain('--avs-overlay-surface');
    expect(css).toMatch(/@media \(prefers-color-scheme: light\)/);
    expect(css).toContain('background: var(--avs-overlay-surface)');
    expect(css).toContain('color: var(--avs-overlay-text)');
    expect(css).toContain('color: var(--avs-overlay-muted)');
    expect(css).toContain('background: var(--avs-overlay-surface-alt)');
  });

  it('keeps overlays within narrow viewports', () => {
    injectStyles();
    const css = injectedCss();
    expect(css).toContain('max-width: calc(100vw - 6px * 2)');
    expect(css).toContain('flex-wrap: wrap');
    expect(css).toMatch(/@media \(max-width: 480px\)/);
    expect(css).toContain('max-height: min(320px, 70vh)');
  });
});

describe('applyHighlightColor', () => {
  it('sets the highlight custom property', () => {
    applyHighlightColor('#ff0000');
    expect(document.documentElement.style.getPropertyValue(HIGHLIGHT_COLOR_VAR)).toBe('#ff0000');
  });
});
