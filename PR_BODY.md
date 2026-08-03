## Summary

Replace every hand-inlined SVG path in the content-script overlays with `lucide-static` source
strings, routed through a single `icon()` helper in `src/content/icons.ts`, so glyphs track the
Lucide library instead of being copy-pasted path data.

## Changes

- `package.json` / `package-lock.json`: add `lucide-static@^0.453.0` (devDependency), pinned to the
  same version as the existing `lucide-react`.
- `src/content/icons.ts`: import icon strings from `lucide-static` and keep one `icon()` helper
  that unwraps the library's 24x24 SVGs and re-wraps them at the overlays' fixed 16x16 size without
  leaking Lucide's `lucide-*` class into the host page. Adds `ICON_BOOK_OPEN`, `ICON_MESSAGE`,
  `ICON_BOOK`, `ICON_MINIMIZE`, `ICON_FILE` (previously duplicated in `toolbar.ts`).
- `src/content/toolbar.ts`: delete the inline `wrap()` block and the ten local `ICON_*` constants;
  import them from `./icons`.
- `src/content/explain-panel.ts`: replace the inline 14x14 close `<svg>` with the shared
  `ICON_CLOSE`.
- `src/content/explain-popover.ts`: delete the local inline `ICON_CLOSE`; import the shared one.
- `src/content/selection-popover.ts`: already imported `ICON_CLOSE` from `./icons`; no change.
- `src/content/icons.test.ts`: new unit tests for the `icon()` helper (fixed size, lucide class
  stripped, every exported constant emits a compact svg).
- `docs/DESIGN_SYSTEM.md`: document that content-script overlays source icons from `lucide-static`
  through `icon()`.

## Testing

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test` — 42 files / 400 tests pass (397 existing + 3 new `icons.test.ts`).
- `npm run build` — app and content IIFE builds succeed; `dist/content.js` 40.58 kB (11.34 kB gzip).
  Verified the bundle contains only the 12 imported icons (tree-shaking drops the rest) and that
  all 12 flow through the `icon()` helper.

## Risks

- The content-script close icon in `explain-panel.ts` goes from 14x14 to the shared 16x16 (the same
  size already used by the other overlays) — a 2px visual change, deliberate for consistency.
- `icon()` relies on `lucide-static`'s stable SVG string format (leading whitespace, `<svg …>`
  wrapper); pinned to `^0.453.0` matching `lucide-react`. A future major format change would need
  the `unwrap` regex revisited — the new tests would catch it.
- The shared 16x16 wrapper is unchanged from before, so overlay layout and styles are unaffected.
