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
      max-width: ${layout.overlayMaxWidth};
      padding: ${spacing.md} ${spacing.lg};
      border-radius: ${radius.md};
      background: ${color.overlaySurface};
      color: ${color.overlayText};
      font: ${typography.overlayBody} ${typography.systemStack};
      box-shadow: ${elevation.overlay};
      pointer-events: none;
    }
    .avs-card[hidden] { display: none; }
    .avs-card-word { font-weight: 600; margin-bottom: ${spacing.xs}; }
    .avs-card-row { margin-top: ${spacing.xs}; }
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
    .avs-explain {
      position: fixed;
      z-index: ${zIndex.overlay};
      width: ${layout.overlayMaxWidth};
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      padding: ${spacing.md} ${spacing.lg};
      border-radius: ${radius.md};
      background: ${color.overlaySurface};
      color: ${color.overlayText};
      font: ${typography.overlayBody} ${typography.systemStack};
      box-shadow: ${elevation.overlay};
      display: flex;
      flex-direction: column;
      gap: ${spacing.md};
    }
    .avs-explain[hidden] { display: none; }
    .avs-explain:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-explain-header { display: flex; align-items: center; gap: ${spacing.sm}; }
    .avs-explain-title {
      flex: 1;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .avs-explain-unit {
      padding: 1px ${spacing.sm};
      border: 1px solid ${color.overlaySurfaceAlt};
      border-radius: ${radius.sm};
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-explain-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.overlayText};
      cursor: pointer;
    }
    .avs-explain-close:hover { background: ${color.overlaySurfaceAlt}; }
    .avs-explain-close:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-explain-hint { margin: 0; color: ${color.overlayMuted}; }
    .avs-explain-btn {
      padding: ${spacing.sm} ${spacing.lg};
      border: 0;
      border-radius: ${radius.sm};
      background: ${color.brand[600]};
      color: ${color.overlayText};
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .avs-explain-btn:hover { background: ${color.brand[700]}; }
    .avs-explain-btn:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-explain-status { margin: 0; color: ${color.overlayMuted}; }
    .avs-explain-error {
      margin: 0;
      padding: ${spacing.sm} ${spacing.md};
      border-radius: ${radius.sm};
      background: ${color.status.danger};
      color: ${color.overlayText};
    }
    .avs-explain-meta { margin: 0; color: ${color.overlayMuted}; font-size: ${typography.overlayLabel}; }
    .avs-explain-section {
      margin: 0;
      padding: ${spacing.sm} ${spacing.md};
      border-radius: ${radius.sm};
      background: ${color.overlaySurfaceAlt};
    }
    .avs-explain-section[open] .avs-explain-section-summary { margin-bottom: ${spacing.xs}; }
    .avs-explain-section-summary {
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
      cursor: pointer;
      user-select: none;
    }
    .avs-explain-section-summary:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-explain-value { margin: 0; }
    .avs-explain-list { margin: 0; padding-left: ${spacing.lg}; }
    .avs-explain-item { margin-top: ${spacing.xs}; }
    @media (prefers-reduced-motion: no-preference) {
      .avs-toast { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-toolbar { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-explain { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      @keyframes avs-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; } }
    }
  `;
  (doc.head ?? doc.documentElement).append(style);
}

/** Apply the user's highlight colour as a CSS custom property. */
export function applyHighlightColor(value: string, doc: Document = document): void {
  doc.documentElement.style.setProperty(HIGHLIGHT_COLOR_VAR, value);
}
