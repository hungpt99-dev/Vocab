## Summary
The "Explain with AI" popover and reading mode were rendering with no styles at all — the injected content stylesheet only covered the hover card, toast, toolbar and smart-AI panel. This adds readable styling for the explain popover's structured sections and the bilingual reading-mode rows, layouts, header and status banner, and introduces the reading-mode design tokens already documented in `docs/DESIGN_SYSTEM.md` but missing from the token module.

## Changes
- `src/shared/styles/tokens.ts`: added the reading-mode tokens — `color.readingSurface`, `color.readingHeader`, `color.readingText`, `color.readingMuted`, `typography.readingBody`, `typography.readingHeading`, `layout.readingMaxWidth` — matching the values already specified in `docs/DESIGN_SYSTEM.md`.
- `src/content/styles.ts`: added `.avs-explain-*` rules (header, title, unit badge, close, hint, button, status, collapsible `<details>` sections, values, lists, meta, error) so the explain popover reads like the rest of the overlay surfaces.
- `src/content/styles.ts`: added `.avs-reading-*` rules — full-page light paper surface, header bar with title/controls, layout select, toggle and close buttons, warning status banner, centered `720px` text column, original/translation rows with heading/paragraph typography, and CSS-only behaviour for all five layouts (`side-by-side` grid, `original-first`, `translation-first`, `hover-translation` via hover/focus, `toggle-translation` via the toggle button). Side-by-side collapses to a single column on narrow viewports.

## Testing
- `npm run typecheck` — passes.
- `npm run lint` — passes (zero warnings).
- `npx vitest run src/shared/styles/tokens.test.ts src/content/styles.test.ts src/content/explain-popover.test.ts src/content/reading-mode.test.ts` — 34 tests pass, including the guard that every hex in the injected stylesheet is a known token.
- `npm run test` — full suite, 397 tests pass across 41 files.
- Manually reviewed the generated CSS: every layout selector matches the `data-layout` / `data-show-translation` / `data-status` state the content script sets, and all values come from tokens.

## Risks
- Reading mode now covers the viewport with `position: fixed; inset: 0`; any host page elements behind it are obscured, but that matches the intended full-page reading surface and closing removes the overlay.
- The `hover-translation` reveal uses `:hover` and `:focus-visible`; keyboard users still reach translations because the original paragraph keeps `tabIndex` in that layout.
- No functionality changed — only presentation. Edge cases like very narrow viewports are handled by the responsive collapse.
