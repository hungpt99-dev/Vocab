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
    .avs-popover {
      position: fixed;
      z-index: ${zIndex.overlay};
      max-width: ${layout.overlayMaxWidth};
      padding: ${spacing.md};
      border-radius: ${radius.md};
      background: ${color.overlaySurface};
      color: ${color.overlayText};
      font: ${typography.overlayBody} ${typography.systemStack};
      box-shadow: ${elevation.overlay};
    }
    .avs-popover[hidden] { display: none; }
    .avs-popover-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${spacing.sm};
      margin-bottom: ${spacing.xs};
    }
    .avs-popover-title {
      font-size: ${typography.overlayLabel};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: ${color.overlayMuted};
    }
    .avs-popover-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.overlayText};
      cursor: pointer;
    }
    .avs-popover-close:hover { background: ${color.overlaySurfaceAlt}; }
    .avs-popover-close:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-popover-status { color: ${color.overlayMuted}; }
    .avs-popover-error { color: ${color.status.danger}; }
    .avs-popover-body { max-height: 240px; overflow-y: auto; }
    .avs-popover-meaning { font-weight: 600; }
    .avs-popover-pronunciation {
      margin-top: ${spacing.xs};
      color: ${color.overlayMuted};
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .avs-popover-simple { margin-top: ${spacing.xs}; }
    .avs-popover-section { margin-top: ${spacing.md}; }
    .avs-popover-label {
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: ${color.overlayMuted};
    }
    .avs-popover-list {
      margin: ${spacing.xs} 0 0;
      padding-left: ${spacing.lg};
    }
    .avs-popover-list li { margin-top: ${spacing.xs}; }
    .avs-menu {
      position: fixed;
      z-index: ${zIndex.overlay};
      min-width: 160px;
      padding: ${spacing.xs};
      border-radius: ${radius.md};
      background: ${color.overlaySurface};
      color: ${color.overlayText};
      font: ${typography.overlayCompact} ${typography.systemStack};
      box-shadow: ${elevation.overlay};
    }
    .avs-menu[hidden] { display: none; }
    .avs-menu-item {
      display: flex;
      align-items: center;
      gap: ${spacing.sm};
      width: 100%;
      padding: ${spacing.sm} ${spacing.md};
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.overlayText};
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .avs-menu-item:hover { background: ${color.overlaySurfaceAlt}; }
    .avs-menu-item:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    @media (prefers-reduced-motion: no-preference) {
      .avs-toast { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-toolbar { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-popover { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-menu { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      @keyframes avs-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; } }
    }
  `;
  (doc.head ?? doc.documentElement).append(style);
}

/** Apply the user's highlight colour as a CSS custom property. */
export function applyHighlightColor(value: string, doc: Document = document): void {
  doc.documentElement.style.setProperty(HIGHLIGHT_COLOR_VAR, value);
}
