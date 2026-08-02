## Summary

Adds structured paragraph-by-paragraph page translation. The DOM is walked into paragraph-sized units (headings, paragraphs, list items, table cells, block quotes), each unit is translated separately through the existing provider abstraction, and text nodes are updated in place around `[[n]]` markers so tags, attributes and page layout are fully preserved. Triggered from the selection toolbar's **Translate** action.

## Changes

- **`src/content/translate/dom.ts`** — DOM traversal (`collectTranslationUnits`): splits the page into block-leaf units, keeps containers as recursion boundaries, skips scripts, code/pre, form controls, contenteditable regions and the extension's own `avs-*` nodes. Each unit carries a placeholder-anchored `source` and an `apply()` that redistributes the translation back onto the original text nodes; `apply()` refuses when the model drops or adds markers, leaving the unit untouched.
- **`src/content/translate/engine.ts`** — provider-agnostic orchestration (`translatePage`/`translateUnits`) with injected `translate` dependency, bounded concurrency, per-unit error tolerance and cancellation.
- **`src/content/translate/translate.ts`** — content-script adapter that routes each unit's translation through the message bus (no provider coupling).
- **`src/content/index.ts`** — wired the existing toolbar **Translate** stub to translate the current page, with a result/error toast.
- **`src/ai/translate-service.ts`** — `TranslationService`, the AI-layer entry point used by the background; resolves the active provider, honours the user's target-language setting, rate-limits and falls back like explanations do.
- **`src/ai/pipeline.ts`** — shared `runWithFallback` + `runAiCall` (rate limit + retry/backoff), extracted from `ExplainService` and reused by `TranslationService` (no duplicated logic).
- **`src/ai/prompts/translate.prompt.ts`** — translation system/user prompts instructing the model to preserve `[[n]]` markers.
- **`src/ai/parse.ts`** — `extractTranslation` for fence-stripping model output.
- **`src/ai/types.ts`** — `TranslateRequest` + `translate()` on the `AiProvider` interface.
- **`src/ai/providers/{openai-compatible,gemini,anthropic}.ts`** — each adapter implements `translate()` via a shared private `complete()` transport helper.
- **`src/shared/messaging/contract.ts`**, **`src/background/handlers.ts`** — `translate` message type, `translateUnit` handler, and `BackgroundDeps.translate`.
- **Docs** — CHANGELOG (Unreleased) and README features/usage updated.

## Testing

- `npm run typecheck` — clean.
- `npm run lint` — clean (zero warnings).
- `npm test` — 246 tests pass (28 files), including 24 new tests: `translate/dom.test.ts` (15, unit collection, placeholder round-trips, tag/attribute preservation, skip rules), `translate/engine.test.ts` (5, orchestration, failure tolerance, cancellation, concurrency), `translate-service.test.ts` (4, provider wiring, target-language setting, fallback, missing key), plus `parse` and background-handler cases.
- `npm run build` — app + content IIFE builds succeed (content bundle 18.1 kB).

## Risks

- Page translation replaces visible text in place; re-running translates the already-translated text (no original-restore yet — out of scope). Very long single paragraphs with many inline elements raise the `[[n]]` marker count, which some models occasionally drop; such units are safely left untranslated rather than corrupted.
- The toolbar **Translate** action was wired as the feature's entry point since the engine needs a reachable path; if VOC-44..48 intend a selection-level translate instead, the trigger can be swapped without touching the engine or AI layer.
