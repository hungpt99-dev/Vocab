## Summary

Implements VOC-46: the "Explain with AI" toolbar action now opens an accessible popover that sends the
full selection context to the provider via `ExplainService` and renders structured, expandable
sections that vary by selection unit (word / phrase / sentence). The AI is called only when the user
clicks Explain — opening the popover never fires a request.

## Changes

- `src/shared/types/explain.ts` (new): `ExplainUnit` + `ExplainRequest` carrying word, unit,
  surrounding paragraph, page title, URL, detected source language and target language. `ExplainRequest`
  is re-exported from `src/ai/types.ts`.
- `src/shared/types/vocabulary.ts` + `src/ai/parse.ts`: `Explanation` gains optional `partOfSpeech`,
  `usage`, `summary` and `difficultVocabulary` fields (backwards-compatible; parsed from the model JSON).
- `src/ai/prompts/`: added unit-specific system prompts and a dispatcher
  (`buildExplainSystemPrompt`, `buildExplainUserPrompt`). The user prompt now includes the surrounding
  context, page title, URL and detected source language. All three providers (OpenAI-compatible,
  Anthropic, Gemini) call the dispatcher instead of the word-only prompt.
- `src/ai/explain-service.ts`: injects the settings `targetLanguage` when the request omits one, and
  includes `unit`/`sourceLanguage` in the cache key so unit-specific results do not collide.
- `src/shared/messaging/contract.ts` + `src/background/handlers.ts`: the `explain` message now carries
  the full `ExplainRequest`; `explainWord` forwards it to `ExplainService` unchanged.
- `src/content/explain-popover.ts` (new): pure-DOM popover (`role="dialog"`, Escape/outside-click
  dismissal, focus moved to the Explain button). Renders per-unit `<details>` sections: word →
  meaning/pronunciation/translation/POS/examples/synonyms/antonyms/collocations/related words;
  phrase → explanation/translation/grammar/usage/examples; sentence → summary/translation/grammar/
  difficult vocabulary. Shows loading, error-with-retry and provider/model states.
- `src/content/toolbar.ts` + `src/content/index.ts`: the toolbar action event now carries the selection
  unit and rect; the explain action opens the popover; the popover is excluded from the mutation
  observer and dismissed on Escape/outside click.
- `src/content/styles.ts`: injected styles for the popover, all values from design tokens.
- Docs: `ARCHITECTURE.md`, `docs/FOLDER_STRUCTURE.md`, `docs/PRODUCT_REQUIREMENTS.md` (FR-4.10),
  `CHANGELOG.md`.

## Testing

- `npm run typecheck` — passes
- `npm run lint` — passes, zero warnings
- `npm run test` — 238 unit tests pass (27 files), including new coverage for the popover (no auto-call
  on open, full-context request, per-unit sections, empty-section skipping, error+retry, Escape/close),
  the prompt dispatcher, parse coercion of the new fields, and target-language injection
- `npm run build` — app + content IIFE bundles succeed (content.js 23.01 kB)
- `npm run test:e2e` — 14 Playwright specs pass in a real Chromium
- Manually verified: opening the popover performs no request; sections are native `<details>` (keyboard
  operable, accessible summaries)

## Risks

- Content-script `readSelection` supplies the surrounding paragraph from the live DOM selection; if the
  selection is cleared between selecting text and clicking Explain, `context` falls back to empty (the
  request still succeeds). No auto-save or provider key ever touches the page.
- `ExplainService` now defaults the target language from settings for all callers (popup included),
  which changes existing explanations only in that they respect the user's configured target language.
- New `Explanation` fields are optional; existing persisted entries remain valid.
