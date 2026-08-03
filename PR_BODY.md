## Summary
Standardises the on-page overlay design tokens and polishes the selection toolbar and selection
popover (VOC-61, plan Task 3): consistent spacing/radius/colour, hover and pressed states, 16px
icons, hairline dividers and the shared overlay shadow. Previously the toolbar's More menu and the
selection popover had no injected styles at all.

## Changes
- `src/shared/styles/tokens.ts`: added `slate.300`/`slate.950` and semantic aliases
  `color.overlaySurfaceActive(+Light)` (pressed state) and `color.overlayDivider(+Light)` (hairline
  divider) so colours stay token-driven.
- `src/shared/styles/tokens.test.ts`: the "only token colours" guard now derives the known colour
  set by flattening `brand`/`color`, so new token colours are validated automatically.
- `src/content/styles.ts`: themed the new `--avs-overlay-surface-active`/`--avs-overlay-divider`
  custom properties; added a toolbar button `:active` state, a vertical `.avs-toolbar-divider`, full
  styles for the previously unstyled `.avs-toolbar-menu` (surface, radius, shadow, item hover/active/
  focus), and the previously unstyled `.avs-popover` card (header with divider, close-button hover/
  active/focus, status/error/meaning/label/list styles). Both new surfaces get the reduced-motion
  fade-in.
- `src/content/toolbar.ts`: renders a hairline divider before the More trigger, marks the trigger
  `aria-haspopup="menu"`, and anchors the More menu below/right-aligned to the trigger via
  `computeMenuPosition` (it previously opened at the viewport origin).
- `src/content/toolbar.test.ts`: added coverage for the divider, `aria-haspopup`, and menu
  positioning.
- `docs/DESIGN_SYSTEM.md`: documented the new slate shades and semantic aliases.

## Testing
- `npm run typecheck` — passes.
- `npm run lint` — zero warnings.
- `npm test` — 398 tests across 41 files pass (incl. new toolbar menu/divider test and the token
  colour guard).
- `npm run build` — app and content bundles build cleanly.

## Risks
- The toolbar More menu is now positioned and styled; its placement flips above the toolbar when
  there is no room below, matching the other overlays. Icons stay 16px (unchanged).
- `.avs-explain`/`.avs-menu` classes (ExplainPopover/MoreMenu) remain unstyled; both components are
  not yet wired into the content entry point, so they are out of scope here. A follow-up can apply
  the same card treatment when wired.
