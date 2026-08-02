import { HIGHLIGHT_CLASS } from './highlighter';
import {
  DEFAULT_HIGHLIGHT_COLOR,
  color,
  elevation,
  layout,
  motion,
  radius,
  reading,
  spacing,
  typography,
  zIndex,
} from '@/shared/styles/tokens';

const STYLE_ID = 'avs-styles';

export const HIGHLIGHT_COLOR_VAR = '--avs-highlight-color';
export const CARD_WIDTH_VAR = '--avs-card-width';
export const CARD_FONT_SIZE_VAR = '--avs-card-font-size';
export const CARD_SPACING_VAR = '--avs-card-spacing';

/**
 * Inject (once) the stylesheet used by highlights, hover card and toasts.
 *
 * This is a hand-built CSS string rather than Tailwind: the content script runs
 * inside arbitrary third-party pages, where Tailwind's utilities do not exist
 * and shipping its preflight would restyle the host page. Every value below
 * comes from the shared design tokens so the two styling paths cannot drift.
 */
export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background-color: var(${HIGHLIGHT_COLOR_VAR}, ${DEFAULT_HIGHLIGHT_COLOR});
      color: inherit;
      border-radius: ${radius.sm};
      padding: 0 1px;
      cursor: help;
      box-decoration-break: clone;
    }
    .${HIGHLIGHT_CLASS}:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-card {
      position: fixed;
      z-index: ${zIndex.overlay};
      max-width: var(${CARD_WIDTH_VAR}, ${reading.width}px);
      padding: ${spacing.md} ${spacing.lg};
      border-radius: ${radius.md};
      background: ${color.overlaySurface};
      color: ${color.overlayText};
      font-family: ${typography.systemStack};
      font-size: var(${CARD_FONT_SIZE_VAR}, ${reading.fontSize}px);
      line-height: var(${CARD_SPACING_VAR}, ${reading.spacing});
      box-shadow: ${elevation.overlay};
      pointer-events: none;
    }
    .avs-card[hidden] { display: none; }
    .avs-card-word {
      font-weight: 600;
      margin-bottom: calc(${spacing.xs} * var(${CARD_SPACING_VAR}, ${reading.spacing}));
    }
    .avs-card-row { margin-top: calc(${spacing.xs} * var(${CARD_SPACING_VAR}, ${reading.spacing})); }
    .avs-card-label {
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-toast {
      position: fixed;
      right: ${spacing.xl};
      bottom: ${spacing.xl};
      z-index: ${zIndex.overlay};
      max-width: ${layout.overlayMaxWidth};
      padding: ${spacing.md} ${spacing.lg};
      border-radius: ${radius.md};
      font: ${typography.overlayCompact} ${typography.systemStack};
      color: ${color.overlayText};
      background: ${color.overlaySurfaceAlt};
      box-shadow: ${elevation.overlay};
    }
    .avs-toast[data-variant='success'] { background: ${color.status.success}; }
    .avs-toast[data-variant='error'] { background: ${color.status.danger}; }
    .avs-toolbar {
      position: fixed;
      z-index: ${zIndex.overlay};
      display: flex;
      align-items: center;
      gap: ${spacing.xs};
      padding: ${spacing.xs} ${spacing.sm};
      border-radius: ${radius.md};
      background: ${color.overlaySurface};
      color: ${color.overlayText};
      box-shadow: ${elevation.overlay};
      font: ${typography.overlayCompact} ${typography.systemStack};
    }
    .avs-toolbar[hidden] { display: none; }
    .avs-toolbar-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.overlayText};
      cursor: pointer;
    }
    .avs-toolbar-btn:hover { background: ${color.overlaySurfaceAlt}; }
    .avs-toolbar-btn:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    @media (prefers-reduced-motion: no-preference) {
      .avs-toast { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-toolbar { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      @keyframes avs-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; } }
    }
  `;
  (doc.head ?? doc.documentElement).append(style);
}

/** Apply the user's highlight colour as a CSS custom property. */
export function applyHighlightColor(value: string, doc: Document = document): void {
  doc.documentElement.style.setProperty(HIGHLIGHT_COLOR_VAR, value);
}

/**
 * Apply the user's reading overlay preferences as CSS custom properties so an
 * open hover card reflows instantly when settings change.
 */
export function applyReadingExperience(
  experience: { width: number; fontSize: number; spacing: number },
  doc: Document = document,
): void {
  const root = doc.documentElement;
  root.style.setProperty(CARD_WIDTH_VAR, `${experience.width}px`);
  root.style.setProperty(CARD_FONT_SIZE_VAR, `${experience.fontSize}px`);
  root.style.setProperty(CARD_SPACING_VAR, String(experience.spacing));
}
