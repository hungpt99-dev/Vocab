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
