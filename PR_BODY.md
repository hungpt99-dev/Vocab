## Summary

VOC-56: make the extension's in-page "reading mode" surfaces accessible. The selection
toolbar, hover card and toast now support full keyboard navigation, expose correct ARIA
semantics, follow the OS light/dark theme, and stay usable on narrow viewports.

## Changes

- `src/content/toolbar.ts` — the selection toolbar now implements the ARIA `toolbar`
  pattern: ArrowLeft/ArrowRight move focus (wrapping), Home/End jump to the first/last
  action, and a single roving tab stop keeps only the active button in the Tab order.
  Added `aria-orientation="horizontal"`.
- `src/content/index.ts` — the toolbar now also appears for keyboard-made selections
  (Shift+arrows), so keyboard-only users get the same actions as mouse users; mouse
  interactions still gate the old `mouseup` path.
- `src/content/styles.ts` — overlay surfaces are now theme-aware via
  `prefers-color-scheme` CSS custom properties (light: slate-50 surfaces / dark text;
  dark: the previous inverted palette). Toolbar wraps and caps at viewport width, the
  hover card scrolls when taller than the viewport, and the toast goes edge-to-edge on
  screens under 480px.
- `src/shared/styles/tokens.ts` — added `slate.200` and light-theme overlay tokens
  (`overlaySurfaceLight`, `overlaySurfaceAltLight`, `overlayTextLight`,
  `overlayMutedLight`) so both styling paths stay token-driven.
- `src/content/toolbar.test.ts` / `src/content/styles.test.ts` — unit tests for the
  keyboard-navigation behaviour and the theme/responsive CSS.
- `CHANGELOG.md` — documented the accessibility work under Unreleased.

## Testing

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test` — 223 tests across 25 files, all passing.
- `npm run build` — app and content bundles build successfully.
- `npm run test:e2e` — 14 Playwright tests against a real Chromium, all passing
  (including the accessibility spec for keyboard focusable highlights).

## Risks

- The content script now injects CSS variables on the host page's `:root`; the names are
  namespaced `--avs-*` so they cannot collide with host styles.
- Light-theme overlays rely on the host reporting `prefers-color-scheme`; pages that
  override `color-scheme` per-element may show the dark variant. Acceptable default.
- The keyboard-selection detection keys off Shift+arrow/Home/End keydowns; other
  selection gestures (e.g. Shift+click) still fall back to the mouse path where
  relevant. None known as blocking.
