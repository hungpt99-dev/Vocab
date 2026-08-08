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
    .avs-selection-card {
      pointer-events: auto;
      width: var(${CARD_WIDTH_VAR}, 320px);
      max-width: calc(100vw - ${spacing.md} * 2);
      max-height: min(420px, 80vh);
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .avs-selection-card[hidden] { display: none; }
    .avs-selection-card-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: ${spacing.md} ${spacing.lg};
      border-bottom: 1px solid var(--avs-overlay-divider);
    }
    .avs-selection-card-word {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.25;
      color: var(--avs-overlay-text);
      word-break: break-word;
    }
    .avs-selection-card-translation {
      font-size: 14px;
      color: var(--avs-overlay-accent);
    }
    .avs-selection-card-actions {
      display: flex;
      align-items: center;
      gap: ${spacing.xs};
      padding: ${spacing.sm} ${spacing.lg};
      border-bottom: 1px solid var(--avs-overlay-divider);
    }
    .avs-selection-card-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: ${radius.sm};
      background: transparent;
      color: var(--avs-overlay-text);
      cursor: pointer;
    }
    .avs-selection-card-btn:hover { background: var(--avs-overlay-surface-alt); }
    .avs-selection-card-btn:active { background: var(--avs-overlay-surface-active); }
    .avs-selection-card-btn:focus-visible { outline: 2px solid ${color.focusRing}; outline-offset: 1px; }
    .avs-selection-card-body {
      display: flex;
      flex-direction: column;
      gap: ${spacing.xs};
      padding: ${spacing.md} ${spacing.lg};
      overflow-y: auto;
    }
    .avs-selection-card-status {
      font-size: 13px;
      color: var(--avs-overlay-muted);
      margin: 0;
    }
    .avs-selection-card-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .avs-selection-card-field-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--avs-overlay-muted);
    }
    .avs-selection-card-field-value {
      font-size: 14px;
      color: var(--avs-overlay-text);
      word-break: break-word;
    }
    .avs-selection-card-list {
      margin: 0;
      padding-left: ${spacing.md};
      font-size: 14px;
      color: var(--avs-overlay-text);
    }
    .avs-selection-card-settings {
      align-self: flex-start;
      margin-top: ${spacing.xs};
      padding: ${spacing.xs} ${spacing.sm};
      border: 0;
      border-radius: ${radius.sm};
      background: var(--avs-overlay-surface-alt);
      color: var(--avs-overlay-text);
      cursor: pointer;
      font-size: 12px;
    }
    .avs-card-explain:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-card-explain[disabled] { opacity: 0.6; cursor: progress; }
    .avs-card-list {
      margin: 2px 0 0;
      padding-left: 16px;
      list-style: disc;
    }
    .avs-card-list li { margin-top: 2px; }
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
    .avs-toolbar--expanded {
      flex-direction: column;
      align-items: stretch;
      max-width: 320px;
    }
    .avs-toolbar--expanded .avs-toolbar-header { border-right: 0; margin-right: 0; padding-right: 0; }
    .avs-toolbar-body {
      display: flex;
      flex-direction: column;
      gap: ${spacing.xs};
      margin-top: ${spacing.xs};
      padding-top: ${spacing.sm};
      border-top: 1px solid var(--avs-overlay-divider);
      max-height: 240px;
      overflow-y: auto;
    }
    .avs-toolbar-status {
      font-size: 12px;
      color: var(--avs-overlay-muted);
      margin: 0;
    }
    .avs-toolbar-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .avs-toolbar-field-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--avs-overlay-muted);
    }
    .avs-toolbar-field-value {
      font-size: 13px;
      color: var(--avs-overlay-text);
    }
    .avs-toolbar-list {
      margin: 0;
      padding-left: ${spacing.md};
      font-size: 13px;
      color: var(--avs-overlay-text);
    }
    .avs-toolbar-explain-settings {
      align-self: flex-start;
      margin-top: ${spacing.xs};
      padding: ${spacing.xs} ${spacing.sm};
      border: 0;
      border-radius: ${radius.sm};
      background: var(--avs-overlay-surface-alt);
      color: var(--avs-overlay-text);
      cursor: pointer;
      font-size: 12px;
    }
    .avs-toolbar-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: ${spacing.xs} ${spacing.xs} ${spacing.xs} 0;
      margin-right: ${spacing.xs};
      border-right: 1px solid var(--avs-overlay-divider);
      min-width: 0;
    }
    .avs-toolbar-word {
      font-size: 14px;
      font-weight: 700;
      color: var(--avs-overlay-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }
    .avs-toolbar-translation {
      font-size: 12px;
      color: var(--avs-overlay-accent);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }
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
    .avs-assist-item--disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .avs-assist-item--disabled:hover,
    .avs-assist-item--disabled:focus-visible {
      background: transparent;
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
    .avs-popover-action {
      margin-top: ${spacing.sm};
      padding: ${spacing.xs} ${spacing.md};
      border: 1px solid var(--avs-overlay-border);
      border-radius: ${radius.sm};
      background: var(--avs-overlay-surface);
      color: var(--avs-overlay-fg);
      font: inherit;
      cursor: pointer;
    }
    .avs-popover-action:hover { background: var(--avs-overlay-surface-active); }
    .avs-popover-action:focus-visible { outline: 2px solid ${color.focusRing}; outline-offset: 1px; }
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
    .avs-explain {
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
    .avs-explain[hidden] { display: none; }
    .avs-explain-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${spacing.md};
      margin-bottom: ${spacing.md};
      padding-bottom: ${spacing.md};
      border-bottom: 1px solid var(--avs-overlay-divider);
    }
    .avs-explain-title { font-weight: 600; }
    .avs-explain-unit {
      margin-left: auto;
      padding: 0 ${spacing.sm};
      border-radius: ${radius.sm};
      background: var(--avs-overlay-surface-alt);
      color: var(--avs-overlay-muted);
      font-size: ${typography.overlayLabel};
      text-transform: capitalize;
    }
    .avs-explain-close {
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
    .avs-explain-close:hover { background: var(--avs-overlay-surface-alt); color: var(--avs-overlay-text); }
    .avs-explain-close:active { background: var(--avs-overlay-surface-active); }
    .avs-explain-close:focus-visible { outline: 2px solid ${color.focusRing}; outline-offset: 1px; }
    .avs-explain-hint { margin: 0 0 ${spacing.md}; color: var(--avs-overlay-muted); }
    .avs-explain-status { margin: 0; color: var(--avs-overlay-muted); }
    .avs-explain-error { margin: 0 0 ${spacing.sm}; color: ${color.status.danger}; }
    .avs-explain-btn,
    .avs-explain-settings {
      display: inline-block;
      margin: ${spacing.xs} ${spacing.sm} 0 0;
      padding: ${spacing.xs} ${spacing.md};
      border: 1px solid var(--avs-overlay-border);
      border-radius: ${radius.sm};
      background: var(--avs-overlay-surface);
      color: var(--avs-overlay-fg);
      font: inherit;
      cursor: pointer;
    }
    .avs-explain-btn:hover,
    .avs-explain-settings:hover { background: var(--avs-overlay-surface-active); }
    .avs-explain-btn:focus-visible,
    .avs-explain-settings:focus-visible { outline: 2px solid ${color.focusRing}; outline-offset: 1px; }
    .avs-explain-section { margin-top: ${spacing.md}; }
    .avs-explain-section-summary {
      cursor: pointer;
      font-weight: 600;
      color: var(--avs-overlay-text);
    }
    .avs-explain-value { margin: ${spacing.xs} 0 0; }
    .avs-explain-list { margin: ${spacing.xs} 0 0; padding-left: ${spacing.lg}; }
    .avs-explain-list li { margin-top: ${spacing.xs}; }
    .avs-explain-meta { margin: ${spacing.md} 0 0; color: var(--avs-overlay-muted); font-size: ${typography.overlayLabel}; }
    @media (prefers-reduced-motion: no-preference) {
      .avs-toast { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-toolbar { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-toolbar-menu { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-assist-menu { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-panel { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
      .avs-popover { animation: avs-fade-in ${motion.fast} ${motion.easing}; }
    .avs-inline-translation {
      display: block;
      margin: 2px 0 6px;
      padding-left: 10px;
      border-left: 2px solid var(--avs-overlay-divider);
      color: var(--avs-overlay-muted);
      font-size: 0.92em;
      line-height: 1.5;
      font-style: italic;
    }
    .avs-inline-translation[hidden] { display: none; }
    .avs-gloss-word {
      cursor: help;
      border-bottom: 1px dotted var(--avs-overlay-divider);
      transition: background-color ${motion.fast} ${motion.easing};
    }
    .avs-gloss-word:hover {
      background-color: var(--avs-overlay-surface-alt);
      border-bottom-color: var(--avs-overlay-muted);
    }
    .avs-word-gloss {
      position: fixed;
      z-index: ${zIndex.overlay};
      display: inline-flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 10px;
      border-radius: ${radius.md};
      background: var(--avs-overlay-surface);
      color: var(--avs-overlay-text);
      box-shadow: ${elevation.overlay};
      font-size: 12px;
      line-height: 1.3;
      pointer-events: auto;
    }
    .avs-word-gloss[hidden] { display: none; }
    .avs-word-gloss-word {
      font-weight: 600;
      color: var(--avs-overlay-text);
    }
    .avs-word-gloss-target {
      color: var(--avs-overlay-muted);
      font-style: italic;
    }
    .avs-inline-control {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: ${zIndex.overlay};
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      border-radius: ${radius.md};
      background: var(--avs-overlay-surface);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    }
    .avs-inline-control[hidden] { display: none; }
    .avs-inline-control-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0 6px 0 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--avs-overlay-text);
      border-right: 1px solid var(--avs-overlay-divider);
      margin-right: 2px;
    }
    .avs-inline-control-label svg { width: 14px; height: 14px; }
    .avs-inline-btn {\

      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: none;
      border-radius: ${radius.sm};
      background: transparent;
      color: var(--avs-overlay-text);
      cursor: pointer;
    }
    .avs-inline-btn:hover { background: var(--avs-overlay-surface-alt); }
    .avs-inline-btn svg { width: 16px; height: 16px; }
    .avs-bilingual-bar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      z-index: ${zIndex.overlay};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 32px;
      padding: 0 8px 0 12px;
      background: var(--avs-overlay-surface);
      color: var(--avs-overlay-text);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      font-size: 12px;
    }
    .avs-bilingual-bar[hidden] { display: none; }
    .avs-bilingual-bar-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
    .avs-bilingual-bar-label svg { width: 14px; height: 14px; }
    .avs-bilingual-bar-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border: none;
      border-radius: ${radius.sm};
      background: transparent;
      color: var(--avs-overlay-text);
      cursor: pointer;
    }
    .avs-bilingual-bar-close:hover { background: var(--avs-overlay-surface-alt); }
    .avs-bilingual-bar-close svg { width: 14px; height: 14px; }
    .avs-bilingual-bar--loading { opacity: 0.85; }
    .avs-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--avs-overlay-muted);
      border-top-color: var(--avs-overlay-text);
      border-radius: 9999px;
      animation: avs-spin 0.7s linear infinite;
      flex: none;
    }
    @keyframes avs-spin { to { transform: rotate(360deg); } }

    /* Loading skeleton shown under a block while its translation streams in. */
    .avs-skeleton-line {
      display: block;
      margin: 2px 0 6px;
      padding-left: 10px;
      height: 0.92em;
      border-left: 2px solid var(--avs-overlay-divider);
      border-radius: 4px;
      background: linear-gradient(
        90deg,
        var(--avs-overlay-surface-alt) 25%,
        var(--avs-overlay-hover, rgba(127, 127, 127, 0.35)) 37%,
        var(--avs-overlay-surface-alt) 63%
      );
      background-size: 400% 100%;
      animation: avs-shimmer 1.3s ease-in-out infinite;
    }
    @keyframes avs-shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: 0 0; }
    }
    .avs-skeleton-line[hidden] { display: none; }
    .avs-bilingual-banner {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: ${zIndex.overlay};
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: min(680px, calc(100vw - 24px));
      padding: 10px 12px;
      border-radius: ${radius.md};
      border: 1px solid var(--avs-overlay-border);
      border-left: 4px solid var(--avs-overlay-border);
      background: var(--avs-overlay-surface);
      color: var(--avs-overlay-text);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24);
      font-size: 13px;
      line-height: 1.4;
    }
    .avs-bilingual-banner-icon { display: inline-flex; color: var(--avs-overlay-muted); flex: none; }
    .avs-bilingual-banner-icon svg { width: 16px; height: 16px; }
    .avs-bilingual-banner-text { flex: 1 1 auto; }
    .avs-bilingual-banner-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex: none;
      border: none;
      border-radius: ${radius.sm};
      background: transparent;
      color: var(--avs-overlay-text);
      cursor: pointer;
    }
    .avs-bilingual-banner-close:hover { background: var(--avs-overlay-surface-alt); }
    .avs-bilingual-banner-close svg { width: 14px; height: 14px; }
    body.avs-bilingual-on { /* reserved hook; bar uses sticky layout, no padding needed */ }
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
