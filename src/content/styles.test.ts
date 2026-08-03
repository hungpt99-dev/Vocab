import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyHighlightColor,
  applyReadingExperience,
  CARD_FONT_SIZE_VAR,
  CARD_SPACING_VAR,
  CARD_WIDTH_VAR,
  HIGHLIGHT_COLOR_VAR,
  injectStyles,
} from './styles';

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

describe('applyReadingExperience', () => {
  it('sets the width, font size and spacing custom properties', () => {
    applyReadingExperience({ width: 360, fontSize: 15, spacing: 1.8 });
    const style = document.documentElement.style;
    expect(style.getPropertyValue(CARD_WIDTH_VAR)).toBe('360px');
    expect(style.getPropertyValue(CARD_FONT_SIZE_VAR)).toBe('15px');
    expect(style.getPropertyValue(CARD_SPACING_VAR)).toBe('1.8');
  });

  it('injects a stylesheet whose card reads the reading custom properties', () => {
    injectStyles();
    const css = document.getElementById('avs-styles')?.textContent ?? '';
    expect(css).toContain(`var(${CARD_WIDTH_VAR}`);
    expect(css).toContain(`var(${CARD_FONT_SIZE_VAR}`);
    expect(css).toContain(`var(${CARD_SPACING_VAR}`);
  });
});
