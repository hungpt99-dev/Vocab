## Summary
Improves AI translation quality by feeding the explainer the page title and a short excerpt of text preceding the selected word (in addition to the existing sentence), and by instructing the model to preserve names, brands, technical terms and code snippets verbatim.

## Changes
- `src/ai/types.ts`: `ExplainRequest` gained optional `pageTitle` and `precedingText` fields.
- `src/ai/prompts/explain-word.prompt.ts`: system prompt now demands verbatim preservation of proper nouns, brand names, technical terms and code snippets; user prompt includes page title and preceding text when available.
- `src/content/selection.ts`: content script captures a ~200-char excerpt of text before the selection as `precedingText`.
- `src/shared/messaging/contract.ts`: `SelectionPayload` carries `precedingText`; the `explain` message payload carries `pageTitle`/`precedingText`.
- `src/background/handlers.ts` + `src/background/index.ts`: pass page title and preceding text through the save and explain flows.
- `src/popup/App.tsx`: popup explain passes `pageTitle` from the entry's source title.
- `src/ai/explain-service.ts`: cache key now includes `pageTitle`/`precedingText` so identical words on different pages don't share a stale explanation.
- Tests: new `explain-word.prompt.test.ts`; coverage for `precedingText` extraction, context propagation through save/explain, and context-aware caching.
- Docs: `docs/AI_PROVIDER.md` and `CHANGELOG.md` updated.

## Testing
- `npm run typecheck` — passes
- `npm run lint` — passes (zero warnings)
- `npm run test` — 224 tests across 26 files, all passing (was 187/23 before this change)
- `npm run build` — production build succeeds (app + content IIFE)

## Risks
- `precedingText` is captured only at save time via the content script; the popup explain path passes page title but no preceding text (entries don't persist it). A follow-up could store the excerpt on the entry if needed.
- The stronger preservation instruction is prompt-level guidance, so a very small local model may still translate some terms; this is a prompt quality improvement, not a guarantee.
