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
    .avs-toolbar-menu {
      position: absolute;
      right: 0;
      bottom: calc(100% + ${spacing.sm});
      display: flex;
      flex-direction: column;
      gap: ${spacing.xs};
      min-width: 160px;
      padding: ${spacing.xs};
      border-radius: ${radius.md};
      background: ${color.overlaySurfaceAlt};
      color: ${color.overlayText};
      box-shadow: ${elevation.overlay};
    }
    .avs-toolbar-menu[hidden] { display: none; }
    .avs-toolbar-menu-item {
      padding: ${spacing.sm} ${spacing.md};
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.overlayText};
      font: ${typography.overlayCompact} ${typography.systemStack};
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
    }
    .avs-toolbar-menu-item:hover { background: ${color.overlaySurface}; }
    .avs-toolbar-menu-item:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-popover {
      position: fixed;
      z-index: ${zIndex.overlay};
      width: ${layout.popoverWidth};
      max-width: calc(100vw - ${spacing.xl} * 2);
      max-height: calc(100vh - ${spacing.xl} * 2);
      overflow-y: auto;
      border-radius: ${radius.md};
      background: ${color.overlaySurface};
      color: ${color.overlayText};
      box-shadow: ${elevation.overlay};
      font: ${typography.overlayBody} ${typography.systemStack};
    }
    .avs-popover[hidden] { display: none; }
    .avs-popover-header {
      display: flex;
      align-items: center;
      gap: ${spacing.sm};
      padding: ${spacing.md} ${spacing.lg};
      border-bottom: 1px solid ${color.overlaySurfaceAlt};
    }
    .avs-popover-mode {
      flex-shrink: 0;
      padding: 1px ${spacing.sm};
      border-radius: ${radius.sm};
      background: ${color.overlaySurfaceAlt};
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-popover-word {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    .avs-popover-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.overlayMuted};
      cursor: pointer;
    }
    .avs-popover-close:hover { background: ${color.overlaySurfaceAlt}; color: ${color.overlayText}; }
    .avs-popover-close:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-popover-body { padding: ${spacing.md} ${spacing.lg}; }
    .avs-popover-status,
    .avs-popover-error { margin: 0; }
    .avs-popover-error { color: ${color.overlayMuted}; }
    .avs-popover-translation {
      margin: 0;
      font-size: 15px;
      line-height: 1.4;
      font-weight: 600;
    }
    .avs-popover-section { margin-bottom: ${spacing.md}; }
    .avs-popover-section:last-child { margin-bottom: 0; }
    .avs-popover-label {
      margin-bottom: ${spacing.xs};
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-popover-section ul { margin: 0; padding-left: ${spacing.xl}; }
    .avs-popover-section li { margin-top: ${spacing.xs}; }
    .avs-popover-retry {
      margin-top: ${spacing.md};
      padding: ${spacing.sm} ${spacing.md};
      border: 0;
      border-radius: ${radius.sm};
      background: ${color.overlaySurfaceAlt};
      color: ${color.overlayText};
      font: ${typography.overlayCompact} ${typography.systemStack};
      cursor: pointer;
    }
    .avs-popover-retry:hover { background: ${color.overlaySurface}; }
    .avs-popover-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${spacing.sm};
      padding: ${spacing.md} ${spacing.lg};
      border-top: 1px solid ${color.overlaySurfaceAlt};
    }
    .avs-popover-meta {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
    }
    .avs-popover-save {
      flex-shrink: 0;
      padding: ${spacing.sm} ${spacing.md};
      border: 0;
      border-radius: ${radius.sm};
      background: ${color.overlaySurfaceAlt};
      color: ${color.overlayText};
      font: ${typography.overlayCompact} ${typography.systemStack};
      cursor: pointer;
    }
    .avs-popover-save:hover:not(:disabled) { background: ${color.overlaySurface}; }
    .avs-popover-save:disabled { opacity: 0.6; cursor: default; }
    .avs-popover-save:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    @media (prefers-reduced-motion: no-preference) {
      .avs-toast { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-toolbar { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-popover { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      @keyframes avs-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; } }
    }
  `;
  (doc.head ?? doc.documentElement).append(style);
}

/** Apply the user's highlight colour as a CSS custom property. */
export function applyHighlightColor(value: string, doc: Document = document): void {
  doc.documentElement.style.setProperty(HIGHLIGHT_COLOR_VAR, value);
}
