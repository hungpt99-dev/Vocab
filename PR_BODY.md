## Summary

Wires the five floating selection-toolbar actions (Explain / Translate / Save / Copy / More) to the
existing typed message bus and background handlers, so the toolbar actually does something instead of
showing a placeholder toast. The content script stays provider-agnostic — every AI call is routed to
the service worker, which owns the provider abstraction.

## Changes

- `src/content/icons.ts` (new): shared inlined Lucide SVG paths for content-script overlays; the
  toolbar's icon helper was moved here to avoid duplication.
- `src/content/toolbar.ts`: toolbar buttons keep their Lucide icons + aria-labels, now sourced from
  `./icons`.
- `src/content/toolbar-actions.ts` (new): pure, dependency-injected action routing —
  `copy` → clipboard, `save` → `save-current-selection`, `explain`/`translate` → result popover via
  the message bus, `more` → dropdown menu (with "Open settings" → `open-options`).
- `src/content/selection-popover.ts` (new): accessible floating popover (`role="dialog"`) that shows
  a loading state, then the structured explanation or translation (or an `role="alert"` error);
  dismissible via Escape, outside click or close button.
- `src/content/more-menu.ts` (new): accessible dropdown (`role="menu"` / `role="menuitem"`) anchored
  to the More button, with viewport clamping and toggle behaviour.
- `src/content/index.ts`: wires the five actions, hides the toolbar while popover/menu are open,
  and excludes the new overlay nodes from the highlighter's mutation rescan.
- `src/content/styles.ts`: token-driven CSS for the popover and menu (no hardcoded design values).
- `src/shared/messaging/contract.ts`: adds `translate` and `open-options` message types/responses.
- `src/background/handlers.ts`: adds `translateWord` (via the provider-agnostic `ExplainService`) and
  the `open-options` handler.
- Tests: new unit suites for `toolbar-actions`, `selection-popover` and `more-menu`, plus
  `translate` / `open-options` handler tests.
- `CHANGELOG.md` updated under Unreleased.

## Testing

- `npm run typecheck` — passes.
- `npm run lint` — passes (zero warnings).
- `npm run test` — 250 unit tests pass (was 187; +63 in this change set).
- `npm run build` — app + content IIFE builds succeed.

## Risks

- `save` relies on the page selection still being live when the background reads it back
  (`save-current-selection`); the toolbar's deferred `mouseup` re-show was suppressed while the
  popover/menu is open to avoid overlap. If a host page clears selection on click, save shows a
  "No selection to save" toast instead of failing silently.
- The translate action currently returns the `translation` field of the full explain model; a
  dedicated translation-only pipeline can replace it without touching the content script.
- None other known.
