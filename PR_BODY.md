## Summary

Implements smart AI assistance on selected/translated content (VOC-54): the selection toolbar's
"More" button now opens a menu exposing Explain sentence, Explain grammar, Explain vocabulary,
Simplify, Summarize and Save difficult words. The five analyses route through the provider-agnostic
`ExplainService` (a dedicated prompt per kind, same response shape), and Save difficult words has the
background extract the hard terms via the AI and persist each to the vocabulary repository.

## Changes

- `src/shared/types/ai.ts`: new `ExplainKind` union (`word | sentence | grammar | vocabulary | simplify | summarize`) shared across the AI layer, message contract and content script.
- `src/ai/types.ts`: `ExplainRequest` gains an optional `kind`.
- `src/ai/prompts/explain-word.prompt.ts`: refactored into a kind-aware prompt builder — `buildExplainSystemPrompt(kind)` returns a per-kind system prompt (all returning the same JSON shape) while `buildExplainWordUserPrompt` adapts the user turn; `EXPLAIN_WORD_SYSTEM_PROMPT` kept for compatibility.
- `src/ai/providers/{openai-compatible,anthropic,gemini}.ts`: use `buildExplainSystemPrompt(request.kind)` instead of the static word prompt.
- `src/ai/explain-service.ts`: cache key now includes `kind`, so the same text analysed differently is not served from the wrong cache entry.
- `src/shared/messaging/contract.ts`: `explain` payload carries `kind?`; new `save-difficult-words` message with `DifficultWordsPayload` → `VocabularyEntry[]`.
- `src/background/handlers.ts`: `explainWord` forwards `kind`; new `saveDifficultWords` (runs a `vocabulary` analysis, splits `term: meaning` items via `splitVocabularyTerm`, saves each through `VocabularyRepository`, broadcasts `vocabulary-changed`); both registered in `createHandlers`.
- `src/content/toolbar.ts`: `ToolbarState` now carries `sentence`/`sourceUrl`/`sourceTitle` (reuses `readSelection`); new `SMART_ASSIST_ACTIONS` registry and `SmartAssistMenu` (role=menu, arrow/Escape/Home/End keyboard support, outside-click/scroll dismissal, focus return).
- `src/content/explain-panel.ts`: new dismissible result overlay (`ExplainPanel`) rendering the returned `Explanation` (meaning, simple words, grammar, key vocabulary, translation, examples) with textContent-built nodes and token-driven styles.
- `src/content/index.ts`: `more` toggles the menu; `avs-assist-action` routes the five analyses to `explain` → `ExplainService` and save to `save-difficult-words` → repository; new nodes excluded from the highlight rescan observer.
- `src/content/styles.ts`: token-based styles for `.avs-assist-menu`, `.avs-assist-item`, `.avs-panel*`.
- Tests: prompt builders (`explain-word.prompt.test.ts`), `SmartAssistMenu`, `ExplainPanel`, `explainWord` kind forwarding, `splitVocabularyTerm`, `saveDifficultWords`, per-kind cache separation.
- Docs: `docs/CHANGELOG.md` and `docs/API_GUIDELINES.md` updated to match the extended contract.

## Testing

- `npm run typecheck` — passes (`tsc --noEmit`, strict).
- `npm run lint` — passes with zero warnings.
- `npm run test` — 240 tests pass (was 216; 24 new/updated).
- `npm run build` — app + content script build succeeds.
- Manually reviewed: menu emits `avs-assist-action` with the captured toolbar state; each AI action sends `{ type: 'explain', kind }`; save sends `save-difficult-words` and persists entries (deduplicated by word key).

## Risks

- "Save difficult words" depends on the model returning `relatedWords` as `term: meaning` entries; a model that returns bare terms still saves the terms (empty note), and non-separated items are treated as whole words. Worst case an entry is saved with an odd word — never an error.
- The menu/panel are new content-script surfaces; dismissal paths (outside click, scroll, Escape) are covered by unit tests but full-page E2E coverage for the injected UI is a follow-up.
- `EXPLAIN_WORD_SYSTEM_PROMPT` is retained as a compatibility export; no behavioural change to the existing word explanation.
