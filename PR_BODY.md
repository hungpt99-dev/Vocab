## Summary

Post-UI/UX-polish verification pass for VOC-64. Typecheck, lint, the dual (app + content) build and
all 397 unit tests were green, but the E2E smoke-check caught two regressions from the earlier
integration merge: unresolved merge-conflict markers were committed into `README.md` / `CHANGELOG.md`,
and the selection toolbar's **Save** / **AI explain** actions fell through to a debug toast instead of
the real message-bus flows. Both are fixed.

## Changes

- `src/content/index.ts` — wired the toolbar **Save** action to `save-current-selection` (persists the
  word, broadcasts `vocabulary-changed`, shows `Saved "word"`) and the toolbar **AI explain** action to
  the existing `runExplain` flow (message bus → `ExplainPanel`); removed the debug `default` branch that
  showed `save: …` / `explain: …` and never saved. `copy` / `more` / `translate` (whole-page) unchanged.
- `src/content/toolbar-actions.ts` + `toolbar-actions.test.ts` — aligned the save-confirmation toast to
  `Saved "word"` (the E2E contract) so the two toolbar handlers cannot drift apart.
- `README.md`, `CHANGELOG.md`, `docs/CHANGELOG.md` — resolved the leftover `<<<<<<<`/`=======`/`>>>>>>>`
  conflict markers committed by the integration merge, keeping the content from both sides, and removed
  a duplicated half-line in `docs/CHANGELOG.md`.

## Testing

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` (app + content dual build) — both pass.
- `npx vitest run` — 397/397 unit tests pass.
- `npm run test:e2e` — 15/15 Playwright tests pass against the built extension, including the previously
  failing `capture.spec.ts › saves a word straight from the page with the floating toolbar` (toast text
  `Saved "serendipity"` and both page highlights now appear).

## Risks

- The toolbar **AI explain** now opens the styled `ExplainPanel` (same flow as smart-assistance); it was
  previously non-functional. The hover-card **AI explain** button and the smart-assistance "More" menu
  remain unwired from the earlier integration (pre-existing, not covered by a failing test) and are
  proposed as a follow-up rather than changed here.
