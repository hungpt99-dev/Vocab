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
    :root {
      --avs-overlay-surface: ${color.overlaySurface};
      --avs-overlay-surface-alt: ${color.overlaySurfaceAlt};
      --avs-overlay-surface-active: ${color.overlaySurfaceActive};
      --avs-overlay-text: ${color.overlayText};
      --avs-overlay-muted: ${color.overlayMuted};
      --avs-overlay-divider: ${color.overlayDivider};
    }
    @media (prefers-color-scheme: light) {
      :root {
        --avs-overlay-surface: ${color.overlaySurfaceLight};
        --avs-overlay-surface-alt: ${color.overlaySurfaceAltLight};
        --avs-overlay-surface-active: ${color.overlaySurfaceActiveLight};
        --avs-overlay-text: ${color.overlayTextLight};
        --avs-overlay-muted: ${color.overlayMutedLight};
        --avs-overlay-divider: ${color.overlayDividerLight};
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
      width: var(${CARD_WIDTH_VAR}, ${layout.overlayMaxWidth});
      max-width: ${layout.overlayMaxWidth};
      max-height: min(320px, 70vh);
      overflow-y: auto;
      padding: ${spacing.md} ${spacing.lg};
      border-radius: ${radius.md};
      background: var(--avs-overlay-surface);
      color: var(--avs-overlay-text);
      font: ${typography.overlayBody} ${typography.systemStack};
      font-size: var(${CARD_FONT_SIZE_VAR}, 1rem);
      line-height: var(${CARD_SPACING_VAR}, 1.5);
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
    .avs-card-explain {
      display: block;
      margin-top: ${spacing.sm};
      padding: ${spacing.xs} ${spacing.md};
      border: 0;
      border-radius: ${radius.sm};
      background: ${color.overlaySurfaceAlt};
      color: ${color.overlayText};
      font: ${typography.overlayCompact} ${typography.systemStack};
      cursor: pointer;
      pointer-events: auto;
    }
    .avs-card-explain:hover { background: ${color.overlaySurface}; }
    .avs-card-explain:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-card-explain[disabled] { opacity: 0.6; cursor: progress; }
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
    .avs-toolbar-btn:active { background: var(--avs-overlay-surface-active); }
    .avs-toolbar-btn:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-toolbar-divider {
      align-self: center;
      width: 1px;
      height: ${spacing.xl};
      margin: 0 ${spacing.xs};
      background: var(--avs-overlay-divider);
    }
    .avs-toolbar-menu {
      position: fixed;
      z-index: ${zIndex.overlay};
      display: flex;
      flex-direction: column;
      min-width: 180px;
      padding: ${spacing.xs};
      border-radius: ${radius.md};
      background: var(--avs-overlay-surface);
      color: var(--avs-overlay-text);
      font: ${typography.overlayCompact} ${typography.systemStack};
      box-shadow: ${elevation.overlay};
    }
    .avs-toolbar-menu[hidden] { display: none; }
    .avs-toolbar-menu-item {
      display: flex;
      align-items: center;
      gap: ${spacing.sm};
      width: 100%;
      padding: ${spacing.sm} ${spacing.md};
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: var(--avs-overlay-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .avs-toolbar-menu-item:hover,
    .avs-toolbar-menu-item:focus-visible {
      background: var(--avs-overlay-surface-alt);
      outline: none;
    }
    .avs-toolbar-menu-item:active { background: var(--avs-overlay-surface-active); }
    .avs-toolbar-menu-item svg { color: var(--avs-overlay-muted); }
    .avs-assist-menu {
      position: fixed;
      z-index: ${zIndex.overlay};
      display: flex;
      flex-direction: column;
      min-width: 200px;
      padding: ${spacing.xs};
      border-radius: ${radius.md};
      background: ${color.overlaySurface};
      color: ${color.overlayText};
      font: ${typography.overlayCompact} ${typography.systemStack};
      box-shadow: ${elevation.overlay};
    }
    .avs-assist-menu[hidden] { display: none; }
    .avs-assist-item {
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
    .avs-assist-item:hover,
    .avs-assist-item:focus-visible {
      background: ${color.overlaySurfaceAlt};
      outline: none;
    }
    .avs-assist-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      color: ${color.overlayMuted};
    }
    .avs-panel {
      position: fixed;
      z-index: ${zIndex.overlay};
      max-width: ${layout.overlayMaxWidth};
      max-height: 70vh;
      overflow-y: auto;
      padding: ${spacing.md} ${spacing.lg};
      border-radius: ${radius.md};
      background: ${color.overlaySurface};
      color: ${color.overlayText};
      font: ${typography.overlayBody} ${typography.systemStack};
      box-shadow: ${elevation.overlay};
    }
    .avs-panel[hidden] { display: none; }
    .avs-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${spacing.md};
      margin-bottom: ${spacing.xs};
    }
    .avs-panel-title { font-weight: 600; }
    .avs-panel-close {
      width: 24px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.overlayMuted};
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
    }
    .avs-panel-close:hover,
    .avs-panel-close:focus-visible {
      background: ${color.overlaySurfaceAlt};
      color: ${color.overlayText};
      outline: none;
    }
    .avs-panel-source {
      margin: 0 0 ${spacing.sm};
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
      font-style: italic;
      overflow-wrap: anywhere;
    }
    .avs-panel-row { margin-top: ${spacing.sm}; }
    .avs-panel-label {
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-panel-list {
      margin: ${spacing.xs} 0 0;
      padding-left: ${spacing.lg};
    }
    .avs-panel-list li { margin-top: ${spacing.xs}; }
    .avs-panel-footer {
      margin: ${spacing.md} 0 0;
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
    }
    .avs-popover {
      position: fixed;
      z-index: ${zIndex.overlay};
      box-sizing: border-box;
      width: ${layout.overlayMaxWidth};
      max-width: calc(100vw - ${spacing.xl} * 2);
      max-height: 70vh;
      overflow-y: auto;
      padding: ${spacing.md} ${spacing.lg};
      border-radius: ${radius.md};
      background: var(--avs-overlay-surface);
      color: var(--avs-overlay-text);
      font: ${typography.overlayBody} ${typography.systemStack};
      box-shadow: ${elevation.overlay};
    }
    .avs-popover[hidden] { display: none; }
    .avs-popover-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${spacing.md};
      margin-bottom: ${spacing.md};
      padding-bottom: ${spacing.md};
      border-bottom: 1px solid var(--avs-overlay-divider);
    }
    .avs-popover-title { font-weight: 600; }
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
      color: var(--avs-overlay-muted);
      cursor: pointer;
    }
    .avs-popover-close:hover {
      background: var(--avs-overlay-surface-alt);
      color: var(--avs-overlay-text);
    }
    .avs-popover-close:active { background: var(--avs-overlay-surface-active); }
    .avs-popover-close:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-popover-status { margin: 0; color: var(--avs-overlay-muted); }
    .avs-popover-error { margin: 0; color: ${color.status.danger}; }
    .avs-popover-meaning { margin: 0 0 ${spacing.sm}; font-weight: 600; }
    .avs-popover-pronunciation { margin: 0 0 ${spacing.sm}; color: var(--avs-overlay-muted); }
    .avs-popover-simple { margin: 0 0 ${spacing.md}; }
    .avs-popover-section { margin-top: ${spacing.md}; }
    .avs-popover-label {
      color: var(--avs-overlay-muted);
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-popover-list { margin: ${spacing.xs} 0 0; padding-left: ${spacing.lg}; }
    .avs-popover-list li { margin-top: ${spacing.xs}; }
    @media (prefers-reduced-motion: no-preference) {
      .avs-toast { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-toolbar { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-toolbar-menu { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-assist-menu { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-panel { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
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

/**
 * Apply the reading-experience overrides (card width, font size and line
 * spacing) as CSS custom properties consumed by the injected stylesheet.
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
