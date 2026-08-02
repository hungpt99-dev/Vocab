import { HIGHLIGHT_CLASS } from './highlighter';
const STYLE_ID = 'avs-styles';
export const HIGHLIGHT_COLOR_VAR = '--avs-highlight-color';
/** Inject (once) the stylesheet used by highlights, hover card and toasts. */
export function injectStyles(doc = document) {
    if (doc.getElementById(STYLE_ID))
        return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background-color: var(${HIGHLIGHT_COLOR_VAR}, #fde68a);
      color: inherit;
      border-radius: 3px;
      padding: 0 1px;
      cursor: help;
      box-decoration-break: clone;
    }
    .${HIGHLIGHT_CLASS}:focus-visible {
      outline: 2px solid #4f46e5;
      outline-offset: 1px;
    }
    .avs-card {
      position: fixed;
      z-index: 2147483647;
      max-width: 320px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #0f172a;
      color: #f8fafc;
      font: 13px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.35);
      pointer-events: none;
    }
    .avs-card[hidden] { display: none; }
    .avs-card-word { font-weight: 600; margin-bottom: 4px; }
    .avs-card-row { margin-top: 4px; }
    .avs-card-label { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .avs-toast {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      max-width: 320px;
      padding: 10px 14px;
      border-radius: 8px;
      font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
      color: #f8fafc;
      background: #1e293b;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.35);
    }
    .avs-toast[data-variant='success'] { background: #15803d; }
    .avs-toast[data-variant='error'] { background: #b91c1c; }
    @media (prefers-reduced-motion: no-preference) {
      .avs-toast { animation: avs-fade-in 150ms ease-out; }
      @keyframes avs-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; } }
    }
  `;
    (doc.head ?? doc.documentElement).append(style);
}
/** Apply the user's highlight colour as a CSS custom property. */
export function applyHighlightColor(color, doc = document) {
    doc.documentElement.style.setProperty(HIGHLIGHT_COLOR_VAR, color);
}
