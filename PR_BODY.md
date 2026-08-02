## Summary

Adds reading-experience controls for the hover card that appears over saved words: hide the original word, hide the translation, and adjust translation width, font size and spacing. Preferences persist in settings and are delivered to the content script through the existing `HighlightData` message contract, which applies them live as CSS custom properties so the overlay reflows instantly on open pages.

## Changes

- `src/shared/types/settings.ts`: new `ReadingExperience` interface (`showOriginal`, `showTranslation`, `width`, `fontSize`, `spacing`) and a `readingExperience` field on `Settings`.
- `src/shared/styles/tokens.ts`: new numeric `reading` token block (defaults + min/max/step bounds); `layout.overlayMaxWidth` and `typography.overlayBody` now derive from it, keeping one source of truth for both the injected stylesheet and the settings UI.
- `src/storage/settings-repository.ts`: `DEFAULT_SETTINGS` gained `readingExperience` mirroring the token defaults.
- `src/shared/messaging/contract.ts` + `src/background/handlers.ts`: `HighlightData` now carries `readingExperience`, projected by `buildHighlightData` from settings.
- `src/content/styles.ts`: `.avs-card` reads `--avs-card-width`, `--avs-card-font-size`, `--avs-card-spacing` (with token fallbacks); new `applyReadingExperience()` writes the variables so an open card updates instantly.
- `src/content/hover-card.ts`: `show()` accepts options to omit the original-word heading and/or the meaning block; note/date always render.
- `src/content/index.ts`: stores the reading experience from `HighlightData` and passes visibility options to the hover card; applies the CSS variables on every refresh (so settings changes reach open pages without a reload).
- `src/features/settings/AppearanceSettings.tsx`: new "Reading experience" section with two toggles and three range sliders (width, font size, spacing) using token bounds.
- Tests: hover-card visibility options, `applyReadingExperience` variables, settings controls, and `HighlightData` passthrough.
- Docs: `README.md` configuration table and both `CHANGELOG.md` files.

## Testing

- `npm run typecheck` — passes.
- `npm run lint` — passes, zero warnings.
- `npm run test` — 226 tests, 25 files, all passing.
- `npm run build` — production build succeeds (app + content).
- `npm run test:e2e` — 14/14 Playwright tests passing (xvfb).

## Risks

- Default rendering is unchanged (defaults mirror the previous token values, both sections shown), so existing highlighting UX is unaffected. Existing stored settings without `readingExperience` fall back to defaults via the repository merge.
- Spacing is a unitless multiplier used in `calc()` for line-height and row gaps; values are clamped by the slider bounds so invalid CSS is not producible from the UI.
- Follow-ups: a live preview in settings, and per-site overrides, were left out of scope.
