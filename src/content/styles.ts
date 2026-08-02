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
      top: calc(100% + ${spacing.xs});
      left: 0;
      z-index: ${zIndex.overlay};
      display: flex;
      flex-direction: column;
      min-width: 160px;
      padding: ${spacing.xs};
      border-radius: ${radius.md};
      background: ${color.overlaySurfaceAlt};
      color: ${color.overlayText};
      box-shadow: ${elevation.overlay};
    }
    .avs-toolbar-menu[hidden] { display: none; }
    .avs-toolbar-menu-item {
      display: flex;
      align-items: center;
      gap: ${spacing.sm};
      padding: ${spacing.sm} ${spacing.md};
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.overlayText};
      font: ${typography.overlayCompact} ${typography.systemStack};
      text-align: left;
      cursor: pointer;
    }
    .avs-toolbar-menu-item:hover { background: ${color.overlaySurface}; }
    .avs-toolbar-menu-item:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-reading-mode {
      position: fixed;
      inset: 0;
      z-index: ${zIndex.overlay};
      display: flex;
      flex-direction: column;
      background: ${color.readingSurface};
      color: ${color.readingText};
      font: ${typography.readingBody} ${typography.systemStack};
    }
    .avs-reading-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${spacing.xl};
      padding: ${spacing.md} ${spacing.xl};
      background: ${color.readingHeader};
      border-bottom: 1px solid ${color.readingMuted};
    }
    .avs-reading-title {
      margin: 0;
      font: ${typography.readingHeading} ${typography.systemStack};
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .avs-reading-controls {
      display: flex;
      align-items: center;
      gap: ${spacing.md};
    }
    .avs-reading-label {
      color: ${color.readingMuted};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-reading-layout {
      padding: ${spacing.xs} ${spacing.sm};
      border: 1px solid ${color.readingMuted};
      border-radius: ${radius.sm};
      background: ${color.readingSurface};
      color: ${color.readingText};
      font: ${typography.overlayCompact} ${typography.systemStack};
    }
    .avs-reading-layout:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-reading-toggle {
      padding: ${spacing.xs} ${spacing.md};
      border: 0;
      border-radius: ${radius.sm};
      background: ${color.overlaySurface};
      color: ${color.overlayText};
      font: ${typography.overlayCompact} ${typography.systemStack};
      cursor: pointer;
    }
    .avs-reading-toggle[hidden] { display: none; }
    .avs-reading-toggle:focus-visible,
    .avs-reading-close:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-reading-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.readingText};
      cursor: pointer;
    }
    .avs-reading-close:hover { background: ${color.readingHeader}; }
    .avs-reading-status {
      padding: ${spacing.md} ${spacing.xl};
      background: ${color.status.dangerBg};
      color: ${color.status.danger};
      font: ${typography.overlayCompact} ${typography.systemStack};
    }
    .avs-reading-status[hidden] { display: none; }
    .avs-reading-scroll {
      flex: 1;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: ${spacing.xl};
    }
    .avs-reading-blocks {
      max-width: ${layout.readingMaxWidth};
      margin: 0 auto;
      display: grid;
      grid-auto-flow: row;
      grid-template-columns: minmax(0, 1fr);
      gap: ${spacing.lg};
    }
    .avs-reading-blocks[data-layout='side-by-side'] {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .avs-reading-blocks[data-layout='side-by-side'] .avs-reading-block {
      display: contents;
    }
    .avs-reading-block {
      display: flex;
      flex-direction: column;
      gap: ${spacing.sm};
    }
    .avs-reading-original {
      font: ${typography.readingBody} ${typography.systemStack};
    }
    .avs-reading-block[data-kind='heading'] .avs-reading-original {
      font: ${typography.readingHeading} ${typography.systemStack};
      font-weight: 600;
    }
    .avs-reading-translation {
      color: ${color.readingMuted};
      font: ${typography.readingBody} ${typography.systemStack};
    }
    .avs-reading-translation[data-status='pending'] { font-style: italic; }
    .avs-reading-translation[data-status='error'] { color: ${color.status.danger}; }
    .avs-reading-blocks[data-layout='original-first'] .avs-reading-original { order: 1; }
    .avs-reading-blocks[data-layout='original-first'] .avs-reading-translation { order: 2; }
    .avs-reading-blocks[data-layout='translation-first'] .avs-reading-original { order: 2; }
    .avs-reading-blocks[data-layout='translation-first'] .avs-reading-translation { order: 1; }
    /* hover-translation reveals the translation on hover or keyboard focus. */
    .avs-reading-blocks[data-layout='hover-translation'] .avs-reading-translation { display: none; }
    .avs-reading-blocks[data-layout='hover-translation'] .avs-reading-block:hover .avs-reading-translation,
    .avs-reading-blocks[data-layout='hover-translation'] .avs-reading-block:focus-within .avs-reading-translation {
      display: block;
    }
    /* toggle-translation visibility is controlled by the header toggle button. */
    .avs-reading-blocks[data-layout='toggle-translation'] .avs-reading-translation { display: none; }
    .avs-reading-blocks[data-layout='toggle-translation'][data-show-translation='true'] .avs-reading-translation {
      display: block;
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
