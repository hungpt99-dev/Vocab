import { HIGHLIGHT_CLASS } from './highlighter';
import {
  DEFAULT_HIGHLIGHT_COLOR,
  color,
  elevation,
  layout,
  motion,
  radius,
  spacing,
  typography,
  zIndex,
} from '@/shared/styles/tokens';

const STYLE_ID = 'avs-styles';

export const HIGHLIGHT_COLOR_VAR = '--avs-highlight-color';

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
    :root {
      --avs-overlay-surface: ${color.overlaySurface};
      --avs-overlay-surface-alt: ${color.overlaySurfaceAlt};
      --avs-overlay-text: ${color.overlayText};
      --avs-overlay-muted: ${color.overlayMuted};
    }
    @media (prefers-color-scheme: light) {
      :root {
        --avs-overlay-surface: ${color.overlaySurfaceLight};
        --avs-overlay-surface-alt: ${color.overlaySurfaceAltLight};
        --avs-overlay-text: ${color.overlayTextLight};
        --avs-overlay-muted: ${color.overlayMutedLight};
      }
    }
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
      box-sizing: border-box;
      max-width: ${layout.overlayMaxWidth};
      max-height: min(320px, 70vh);
      overflow-y: auto;
      padding: ${spacing.md} ${spacing.lg};
      border-radius: ${radius.md};
      background: var(--avs-overlay-surface);
      color: var(--avs-overlay-text);
      font: ${typography.overlayBody} ${typography.systemStack};
      box-shadow: ${elevation.overlay};
      pointer-events: none;
    }
    .avs-card[hidden] { display: none; }
    .avs-card-word { font-weight: 600; margin-bottom: ${spacing.xs}; }
    .avs-card-row { margin-top: ${spacing.xs}; }
    .avs-card-label {
      color: var(--avs-overlay-muted);
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-toast {
      position: fixed;
      right: ${spacing.xl};
      bottom: ${spacing.xl};
      z-index: ${zIndex.overlay};
      box-sizing: border-box;
      max-width: ${layout.overlayMaxWidth};
      padding: ${spacing.md} ${spacing.lg};
      border-radius: ${radius.md};
      font: ${typography.overlayCompact} ${typography.systemStack};
      color: var(--avs-overlay-text);
      background: var(--avs-overlay-surface-alt);
      box-shadow: ${elevation.overlay};
    }
    @media (max-width: 480px) {
      .avs-toast { right: ${spacing.sm}; bottom: ${spacing.sm}; left: ${spacing.sm}; }
    }
    .avs-toast[data-variant='success'] { background: ${color.status.success}; }
    .avs-toast[data-variant='error'] { background: ${color.status.danger}; }
    .avs-toolbar {
      position: fixed;
      z-index: ${zIndex.overlay};
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: ${spacing.xs};
      box-sizing: border-box;
      max-width: calc(100vw - ${spacing.sm} * 2);
      padding: ${spacing.xs} ${spacing.sm};
      border-radius: ${radius.md};
      background: var(--avs-overlay-surface);
      color: var(--avs-overlay-text);
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
      color: var(--avs-overlay-text);
      cursor: pointer;
    }
    .avs-toolbar-btn:hover { background: var(--avs-overlay-surface-alt); }
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
