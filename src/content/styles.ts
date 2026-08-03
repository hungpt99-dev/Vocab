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
    .avs-toolbar-btn:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
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
    .avs-explain {
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
    .avs-explain[hidden] { display: none; }
    .avs-explain-header {
      display: flex;
      align-items: center;
      gap: ${spacing.sm};
      margin-bottom: ${spacing.xs};
    }
    .avs-explain-title {
      flex: 1;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .avs-explain-unit {
      flex: none;
      padding: 1px ${spacing.sm};
      border-radius: ${radius.sm};
      background: ${color.overlaySurfaceAlt};
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-explain-close {
      flex: none;
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
    .avs-explain-close:hover,
    .avs-explain-close:focus-visible {
      background: ${color.overlaySurfaceAlt};
      color: ${color.overlayText};
      outline: none;
    }
    .avs-explain-hint {
      margin: 0 0 ${spacing.md};
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
    }
    .avs-explain-btn {
      display: inline-block;
      margin-top: ${spacing.sm};
      padding: ${spacing.xs} ${spacing.md};
      border: 0;
      border-radius: ${radius.sm};
      background: ${color.overlaySurfaceAlt};
      color: ${color.overlayText};
      font: ${typography.overlayCompact} ${typography.systemStack};
      cursor: pointer;
    }
    .avs-explain-btn:hover { background: ${color.overlaySurface}; }
    .avs-explain-btn:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-explain-status {
      margin: ${spacing.sm} 0 0;
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
    }
    .avs-explain-section {
      margin-top: ${spacing.md};
      padding: ${spacing.sm} ${spacing.md};
      border: 1px solid ${color.overlaySurfaceAlt};
      border-radius: ${radius.md};
    }
    .avs-explain-section[open] { background: ${color.overlaySurfaceAlt}; }
    .avs-explain-section-summary {
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
      cursor: pointer;
      user-select: none;
    }
    .avs-explain-section-summary:hover,
    .avs-explain-section-summary:focus-visible {
      color: ${color.overlayText};
      outline: none;
    }
    .avs-explain-value {
      margin: ${spacing.xs} 0 0;
      overflow-wrap: anywhere;
    }
    .avs-explain-list {
      margin: ${spacing.xs} 0 0;
      padding-left: ${spacing.lg};
    }
    .avs-explain-item { margin-top: ${spacing.xs}; }
    .avs-explain-meta {
      margin: ${spacing.md} 0 0;
      color: ${color.overlayMuted};
      font-size: ${typography.overlayLabel};
    }
    .avs-explain-error {
      margin: ${spacing.md} 0 0;
      color: ${color.status.danger};
      font: ${typography.overlayCompact} ${typography.systemStack};
    }
    .avs-reading-mode {
      position: fixed;
      inset: 0;
      z-index: ${zIndex.overlay};
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      background: ${color.readingSurface};
      color: ${color.readingText};
      font: ${typography.readingBody} ${typography.systemStack};
    }
    .avs-reading-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${spacing.lg};
      padding: ${spacing.md} ${spacing.xl};
      background: ${color.readingHeader};
      border-bottom: 1px solid ${color.readingMuted};
    }
    .avs-reading-title {
      margin: 0;
      font: ${typography.readingHeading} ${typography.systemStack};
      overflow-wrap: anywhere;
    }
    .avs-reading-controls {
      display: flex;
      align-items: center;
      gap: ${spacing.md};
      flex: none;
    }
    .avs-reading-label {
      color: ${color.readingMuted};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-reading-layout {
      padding: ${spacing.xs} ${spacing.md};
      border: 1px solid ${color.readingMuted};
      border-radius: ${radius.sm};
      background: ${color.readingSurface};
      color: ${color.readingText};
      font: ${typography.overlayCompact} ${typography.systemStack};
      cursor: pointer;
    }
    .avs-reading-layout:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-reading-toggle {
      padding: ${spacing.xs} ${spacing.md};
      border: 0;
      border-radius: ${radius.sm};
      background: ${color.brand[600]};
      color: ${color.readingSurface};
      font: ${typography.overlayCompact} ${typography.systemStack};
      cursor: pointer;
    }
    .avs-reading-toggle:hover { background: ${color.brand[700]}; }
    .avs-reading-toggle:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-reading-close {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.readingMuted};
      cursor: pointer;
    }
    .avs-reading-close:hover,
    .avs-reading-close:focus-visible {
      background: ${color.readingHeader};
      color: ${color.readingText};
      outline: none;
    }
    .avs-reading-status {
      padding: ${spacing.sm} ${spacing.xl};
      background: ${color.status.warningBg};
      color: ${color.status.warning};
      font: ${typography.overlayCompact} ${typography.systemStack};
    }
    .avs-reading-status[hidden] { display: none; }
    .avs-reading-scroll {
      flex: 1;
      overflow-y: auto;
    }
    .avs-reading-blocks {
      max-width: ${layout.readingMaxWidth};
      margin: 0 auto;
      padding: ${spacing.xl};
    }
    .avs-reading-block {
      display: flex;
      flex-direction: column;
      gap: ${spacing.xs};
      padding: ${spacing.md} 0;
      border-bottom: 1px solid ${color.readingMuted};
    }
    .avs-reading-block:last-child { border-bottom: 0; }
    .avs-reading-block[data-kind='heading'] .avs-reading-original {
      font: ${typography.readingHeading} ${typography.systemStack};
    }
    .avs-reading-translation {
      color: ${color.readingMuted};
    }
    .avs-reading-translation[data-status='pending'] { font-style: italic; }
    .avs-reading-translation[data-status='error'] {
      color: ${color.status.danger};
      font-style: italic;
    }
    .avs-reading-blocks[data-layout='side-by-side'] .avs-reading-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${spacing.xl};
    }
    .avs-reading-blocks[data-layout='translation-first'] .avs-reading-block {
      flex-direction: column-reverse;
    }
    .avs-reading-blocks[data-layout='hover-translation'] .avs-reading-translation,
    .avs-reading-blocks[data-layout='toggle-translation']:not([data-show-translation='true']) .avs-reading-translation {
      display: none;
    }
    .avs-reading-blocks[data-layout='hover-translation'] .avs-reading-block:hover .avs-reading-translation,
    .avs-reading-blocks[data-layout='hover-translation'] .avs-reading-original:focus-visible + .avs-reading-translation,
    .avs-reading-blocks[data-layout='toggle-translation'][data-show-translation='true'] .avs-reading-translation {
      display: block;
    }
    @media (max-width: ${layout.readingMaxWidth}) {
      .avs-reading-blocks[data-layout='side-by-side'] .avs-reading-block {
        grid-template-columns: 1fr;
        gap: ${spacing.xs};
      }
      .avs-reading-header {
        flex-wrap: wrap;
      }
    }
    @media (prefers-reduced-motion: no-preference) {
      .avs-toast { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-toolbar { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-assist-menu { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-panel { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-explain { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-reading-mode { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
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
