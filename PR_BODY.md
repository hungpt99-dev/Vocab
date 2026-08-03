## Summary

The popup's background-dependent capture features were dead: the service worker never registered a
`get-selection` handler, so the popup's mount-time request to read the active page selection failed
and `TranslatePanel`/`SaveForm` had no context. The content script's toolbar save also showed a raw
`save: word` toast instead of a proper confirmation, inconsistent with the popup's `Saved "word"`.

## Changes

- `src/background/handlers.ts`: register the `get-selection` handler in `createHandlers`, delegating
  to the existing `readActiveSelection()` (popup → worker → tab chain now resolves).
- `src/content/index.ts`: wire the toolbar `save` action to the `save-current-selection` message bus
  handler; it now actually persists and confirms with a consistent `Saved "word"` toast (previously
  fell through to a `save: word` placeholder). Updated the stale "wired in later issues" comment.
- `src/background/handlers.test.ts`: cover `get-selection` via `dispatch`, including the no-content-
  script path returning `null`.
- `src/features/capture/TranslatePanel.test.tsx` (new): assert it renders only with a selection,
  translates via the bus, and surfaces background failures next to the action.
- `e2e/capture.spec.ts`: add a test proving the popup's `get-selection` request returns the active
  page selection through the background.

## Testing

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm test` — 402 unit tests pass (incl. new handler + TranslatePanel tests).
- `xvfb-run -a npx playwright test` — 16 e2e tests pass, including the new "popup reads the active
  page selection through the background" test and the previously failing "saves a word straight from
  the page with the floating toolbar" toast assertion.

## Risks

The toolbar `translate` and `copy`/`more` paths are unchanged; only `save` was wired. The unused
`src/content/toolbar-actions.ts` still carries an older `Saved "word" to your vocabulary.` wording but
is not wired into production flow, so it has no runtime effect. `get-selection` intentionally returns
`null` when the active tab has no content script (chrome:// pages), which the popup already tolerates.
