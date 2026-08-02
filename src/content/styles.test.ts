import { beforeEach, describe, expect, it } from 'vitest';
import { applyHighlightColor, HIGHLIGHT_COLOR_VAR, injectStyles } from './styles';

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
