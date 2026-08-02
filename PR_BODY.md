## Summary

VOC-53 wires saved vocabulary into the reading experience: highlights now cover both the original and
translated columns of bilingual pages, the hover card surfaces pronunciation plus an in-place AI-explain
shortcut, and any word can be saved straight from the page with the floating toolbar's Save action.

## Changes

- `src/shared/messaging/contract.ts` / `src/background/handlers.ts`: `HighlightData` entries now carry
  `pronunciation` (from the cached explanation) so the content script can render it.
- `src/content/hover-card.ts`: the card shows a pronunciation row when available and an **AI explain**
  button. Added `update()`, `setExplaining()` (loading state) and `contains()`; the shortcut dispatches
  an `avs-card-action` CustomEvent.
- `src/content/index.ts`:
  - `attachHoverListeners` keeps the card open while the pointer/focus is on it so the shortcut is
    clickable; Escape still dismisses it.
  - `attachCardActions` routes the card's explain shortcut through the message bus to the
    provider-agnostic `ExplainService` in the background worker (no provider coupling in content
    script), then re-renders the card with the fresh meaning/pronunciation.
  - `handleToolbarAction` now wires the toolbar's **Save** action; `saveFromReading` persists the
    selected word via `save-entry` using selection metadata captured when the toolbar opened (clicking
    the toolbar clears the page selection).
- `src/content/toolbar.ts`: `ToolbarState` captures the `SelectionPayload` at show time and passes the
  full state through the toolbar action event.
- `src/content/styles.ts`: styles for the interactive `.avs-card-explain` button (`pointer-events: auto`
  within the otherwise inert card).
- Tests: unit coverage for pronunciation display, the AI-explain shortcut + loading/update behaviour,
  hover-card `contains`, two-column highlighting, and pronunciation in highlight data; a new e2e test
  drives save-from-reading end to end.
- Docs: `CHANGELOG.md`, `docs/CHANGELOG.md`, `docs/PRODUCT_REQUIREMENTS.md` (FR-1.9, FR-3.9, FR-3.10)
  and the README feature/usage sections updated.

## Testing

- `npx tsc --noEmit` — passes.
- `npx eslint .` — passes (zero warnings).
- `npx vitest run` — 225 tests pass across 25 files.
- `npm run build` — app + content IIFE builds succeed.
- `xvfb-run -a npx playwright test` — 15 e2e tests pass, including the new "saves a word straight from
  the page with the floating toolbar" and the existing hover-card/keyboard-focus specs.

## Risks

- The hover card now contains an interactive button inside a `role="tooltip"`; hover/focus logic keeps
  it open while interacting, and existing keyboard/Escape behaviour is preserved. An explanation via the
  card depends on a configured AI provider — if none is set, the background returns a clear error toast.
- The toolbar Save uses selection metadata captured at toolbar-open time; if a caller supplies no
  selection (e.g. keyboard edge cases) it falls back to saving just the selected text without the
  surrounding sentence. `vocabulary-changed` re-highlights immediately as before.
