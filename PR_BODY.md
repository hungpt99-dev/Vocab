## Summary

Polish pass over the popup and options React UI: make empty-state iconography consistent and close the remaining accessibility gaps by adding visible focus indicators and preserving accessible names on every interactive control.

## Changes

- **`src/shared/ui/Toast.tsx`** — the dismiss button now renders the standard focus ring (`focus-visible:ring-2 ring-brand-600`, with dark-mode offset) so keyboard users can see where focus is.
- **`src/shared/ui/TagInput.tsx`** — the tag input had no visible focus indicator (`focus:outline-none` with no replacement). The chip container now lights up with a brand ring via `focus-within`, matching the rest of the form controls.
- **`src/features/settings/AppearanceSettings.tsx`** — the reading-experience range sliders now show the same focus ring as the colour picker beside them.
- **`src/popup/App.tsx`** — the library's "No words yet / No matches" empty state uses `BookIcon` instead of the settings gear, matching the identical empty state in `LibraryList`.
- **`src/shared/ui/ui.test.tsx`** — new `Toast` test: a notification is announced as a `status` region and dismissed via its labelled button.
- **`e2e/accessibility.spec.ts`** — new regression test: Tab through every popup control and assert each shows a visible focus ring (ring may sit on the focused element or an ancestor).
- **`CHANGELOG.md`** — user-visible changes documented under Unreleased.

## Testing

- `npm run typecheck` — passes.
- `npm run lint` — passes, zero warnings.
- `npm run test` — 398 tests, all pass (including the new Toast test).
- `npm run build` — succeeds (run as part of `test:e2e`).
- `npm run test:e2e` — 15/16 pass, including the new focus-ring test.

## Risks

- One E2E test fails **pre-existing and unrelated** to this change: `e2e/capture.spec.ts:101` ("saves a word straight from the page with the floating toolbar") expects a content-script toast of `Saved "serendipity"` but the code emits `Saved "serendipity" to your vocabulary.` (and the observed DOM toast was `save: serendipity`). Verified identical failure on the clean base branch via `git stash`. It concerns the content-script floating toolbar, not the popup/options React UI, and looks like a stale test vs. in-flight work (the repo also has unmerged conflict markers in `README.md`/`CHANGELOG.md`). Left untouched to avoid a drive-by change; recommended as a follow-up.
- Focus rings are `focus-visible`-scoped, so mouse users see no change; the popup remains overflow-free at 320 px (existing E2E still passes).
