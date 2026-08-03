import { color, elevation, radius, spacing, typography, zIndex } from '@/shared/styles/tokens';

const STYLE_ID = 'avs-reading-styles';
export const READER_FONT_SIZE_VAR = '--avs-reader-font-size';

const divider = `${color.slate[400]}4d`;

/**
 * Inject (once) the stylesheet used by the bilingual reader. Like the highlight
 * styles this is a hand-built CSS string rather than Tailwind, because the
 * content script runs inside arbitrary third-party pages.
 */
export function injectReadingStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .avs-reader {
      position: fixed;
      inset: 0;
      z-index: ${zIndex.overlay};
      display: flex;
      flex-direction: column;
      background: ${color.slate[50]};
      color: ${color.slate[900]};
      font-family: ${typography.systemStack};
      font-size: 16px;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }
    .avs-reader-bar {
      display: flex;
      align-items: center;
      gap: ${spacing.md};
      flex-wrap: wrap;
      padding: ${spacing.md} ${spacing.xl};
      background: #ffffff;
      border-bottom: 1px solid ${divider};
      box-shadow: ${elevation.overlay};
      z-index: 1;
    }
    .avs-reader-title { font-weight: 600; }
    .avs-reader-lang {
      color: ${color.slate[400]};
      font-size: ${typography.overlayLabel};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .avs-reader-btn, .avs-reader-select {
      height: 30px;
      padding: 0 ${spacing.md};
      border: 1px solid ${divider};
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.slate[800]};
      font-family: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .avs-reader-btn:hover, .avs-reader-select:hover { background: ${color.slate[50]}; }
    .avs-reader-btn:focus-visible, .avs-reader-select:focus-visible {
      outline: 2px solid ${color.focusRing};
      outline-offset: 1px;
    }
    .avs-reader-btn[aria-pressed='true'] {
      background: ${color.brand[100]};
      border-color: ${color.brand[400]};
    }
    .avs-reader-close { margin-left: auto; }
    .avs-reader-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
    .avs-reader-content {
      max-width: 72ch;
      margin: 0 auto;
      padding: ${spacing.xl};
      font-size: var(${READER_FONT_SIZE_VAR}, 16px);
    }
    .avs-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: ${spacing.xl};
      margin-bottom: ${spacing.xl};
      min-width: 0;
    }
    .avs-block-col { min-width: 0; }
    .avs-block-col p { margin: 0 0 ${spacing.sm}; }
    .avs-block-tgt { color: ${color.slate[800]}; }
    .avs-layout-side-by-side .avs-block-tgt { padding-left: ${spacing.xl}; border-left: 1px solid ${divider}; }
    .avs-layout-original-first .avs-block, .avs-layout-translation-first .avs-block { grid-template-columns: 1fr; }
    .avs-layout-original-first .avs-block-tgt, .avs-layout-translation-first .avs-block-tgt { border-left: 0; padding-left: 0; }
    .avs-layout-translation-first .avs-block-tgt { order: -1; }
    .avs-layout-hover .avs-block-tgt { display: none; }
    .avs-layout-hover .avs-block:hover .avs-block-tgt,
    .avs-layout-hover .avs-block:focus-within .avs-block-tgt { display: block; }
    .avs-layout-toggle[data-view='original'] .avs-block-tgt { display: none; }
    .avs-layout-toggle[data-view='translation'] .avs-block-src { display: none; }
    .avs-block-placeholder {
      color: ${color.slate[400]};
      font-style: italic;
    }
    .avs-reader[data-align='sentence'] .avs-block { grid-template-columns: 1fr; }
    .avs-reader[data-align='sentence'] .avs-block-tgt { border-left: 0; padding-left: 0; }
    .avs-reader[data-bilingual='off'] .avs-block-tgt { display: none; }
    .avs-reader[data-bilingual='off'] .avs-block { grid-template-columns: 1fr; }
    .avs-chunk-error {
      margin-bottom: ${spacing.xl};
      padding: ${spacing.md} ${spacing.lg};
      border-radius: ${radius.md};
      background: ${color.status.dangerBg};
      color: ${color.status.danger};
      display: flex;
      align-items: center;
      gap: ${spacing.md};
    }
    .avs-chunk-error button {
      margin-left: auto;
      border: 1px solid ${color.status.danger};
      border-radius: ${radius.sm};
      background: transparent;
      color: ${color.status.danger};
      padding: ${spacing.xs} ${spacing.md};
      font-family: inherit;
      cursor: pointer;
    }
    @media (max-width: 640px) {
      .avs-block { grid-template-columns: 1fr; }
      .avs-layout-side-by-side .avs-block-tgt { border-left: 0; padding-left: 0; }
    }
  `;
  (doc.head ?? doc.documentElement).append(style);
}

/** Apply the reader base font size as a CSS custom property. */
export function applyReaderFontSize(value: number, doc: Document = document): void {
  doc.documentElement.style.setProperty(READER_FONT_SIZE_VAR, `${value}px`);
}
