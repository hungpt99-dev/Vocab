## Summary
Completes the Smart Text Selection epic (VOC-41): the floating toolbar now does more than show — Explain and Translate open a viewport-aware AI popover, Save persists the selection to the vocabulary, and More offers copying the source sentence or a citation. Content-script AI calls go through the message bus and the provider-agnostic `ExplainService`; no provider SDK is touched inside the content script.

## Changes
- `src/content/explain-popover.ts` (new): pure-DOM popover (`ExplainPopover`) with loading, error/retry and success states; renders the full `Explanation` (translation, meaning, plain-words, pronunciation, grammar, examples, synonyms, antonyms, related words, collocations, provider/model) in `explain` mode and translation only in `translate` mode; viewport-clamped via the existing `computePosition` helper; exposes a "Save to vocabulary" button that stays open on save failure.
- `src/content/toolbar.ts`: added a More menu (`avs-toolbar-menu`) with "Copy source sentence" and "Copy citation"; `aria-haspopup`/`aria-expanded`; menu closes on hide or other action; `ToolbarActionId` now covers the menu actions.
- `src/content/index.ts`: wired all toolbar actions — `explain`/`translate` open the popover, `save` persists the selection with source context, `copy`/`copy-sentence`/`copy-citation` write to the clipboard; outside-click and Escape now dismiss the popover too; popover is excluded from toolbar re-show and from the highlighter's own-node rescan loop.
- `src/content/styles.ts`: token-driven CSS for the popover and the More menu.
- `src/shared/styles/tokens.ts`: added `layout.popoverWidth` token.
- `src/content/explain-popover.test.ts` (new, 7 tests): loading → explanation, empty-field skipping, translate mode, error + retry, save success/failure, stale-response guard.
- `src/content/toolbar.test.ts`: 2 new tests for the More menu toggle and hide behaviour.
- `docs/CHANGELOG.md`, `README.md`: documented the smart selection feature.

## Testing
- `npm run typecheck` (`tsc --noEmit`) — clean.
- `npm run lint` (`eslint .`) — clean (zero warnings).
- `npm test` (`vitest run`) — 26 files, 225 tests, all green (was 216; +9 new).
- `npm run build` — app + content IIFE builds succeed.
- Manually reasoned: popover positions below the selection, flips/clamps at viewport edges, follows scroll; toolbar hides when the popover opens and when selection collapses; Escape and outside clicks dismiss.

## Risks
- The Explain/Translate popover calls the full explanation endpoint even for translation-only mode (reuses the existing `explain` message); acceptable since the model already returns `translation`, but a dedicated lighter endpoint could be a follow-up.
- Popover content lives inside the host page and could in principle be highlighted on a later vocabulary refresh while open (same pre-existing behaviour as the hover card); mitigated by excluding `avs-popover` from the rescan loop.
- Local environment note: node_modules had been installed with a different package manager; restored to the tracked `package-lock.json` via `npm install`. No lockfile changes committed.
