# VOC-67 Bilingual mode + language picker + editable explain prompt — Plan

> **For Hermes:** Plan → Linear issue VOC-67 → auto-code via CodingAutomation. Linear is source of truth.

**Goal:** Let users run the extension in a **bilingual mode**: pick their language, toggle bilingual rendering, and **edit the explain prompt** to get richer output (more info than the default).

## Background (verified)
- `Settings.targetLanguage: string` exists and is used by `translate` + `reading-mode` (reader.ts:118), but the **explain flow does NOT pass it** — `runExplain` (content/index.ts) sends `{word, context, kind}` with no `language`, so explanations are always English.
- Explain prompts: `src/ai/prompts/explain-word.prompt.ts` (`EXPLAIN_WORD_SYSTEM_PROMPT`, `buildExplainWordUserPrompt`) + `explain-selection.prompt.ts` (phrase/sentence). Fixed JSON schema: meaning/translation/grammar/examples (+ sentence: summary/difficultVocabulary; phrase: usage).
- `Explanation` type (shared/types/vocabulary) holds the rendered fields. `ExplanationView` renders them.
- `reading-mode.ts` already bilingual (shows translation in `targetLanguage`); it just needs a toggle surface.

## Quality gates (every task)
- `npm run typecheck` (0 errors), `npm run lint` (clean), `npm test` (unit), `npm run build` (app + content), `npm run test:e2e` (new option-panel e2e).
- Icons from lucide only. No emoji/unicode/hand-SVG.

## Task 1: Settings model
**Files:** `src/shared/types/settings.ts`, `src/storage/settings-repository.ts` (default + migration).
**Add:**
- `bilingualMode: boolean` (default `true` — keep current behaviour).
- `explainPromptTemplate: string` — editable system-prompt template. Support tokens `{{language}}`, `{{word}}`, `{{context}}`, `{{kind}}`. Default = the current `EXPLAIN_WORD_SYSTEM_PROMPT` enriched (Task 3). Empty/`undefined` → use built-in default.
- Keep `targetLanguage` (already present); ensure it has a sensible default (`'English'`).
**Verify:** settings round-trip + migration from old shape. Unit tests.

## Task 2: Options UI — language picker + bilingual toggle + prompt editor
**Files:** `src/features/settings/ProviderSettings.tsx` (or a new `AiSettings.tsx` section), `src/options/*`.
**Add to Options page:**
- **Target language** `<select>` populated from a static language list (config-driven, not hardcoded literals — reuse a `LANGUAGES` const array). Writes `targetLanguage`.
- **Bilingual mode** toggle → `bilingualMode`.
- **Explain prompt** `<textarea>` bound to `explainPromptTemplate`, with a **Reset to default** button. Helper text listing tokens (`{{language}} {{word}} {{context}} {{kind}}`).
**Verify:** typing persists; reset works; toggle persists.

## Task 3: Richer default prompt ("show more info")
**Files:** `src/ai/prompts/explain-word.prompt.ts` (+ phrase/sentence variants), `src/shared/types/vocabulary.ts` (`Explanation`), `src/features/library/ExplanationView.tsx`.
**Extend default explain schema** to include more fields, e.g. `pronunciation`, `synonyms`, `register` (formal/informal), `etymology`, `relatedPhrases`, `examples` (keep). Update `Explanation` type + `ExplanationView` to render the new fields (lucide icons per field). Keep JSON-only contract. Backward compatible (missing fields render as absent).

## Task 4: Wire explain to targetLanguage + editable template
**Files:** `src/ai/providers/openai-compatible.ts`, `anthropic.ts`, `gemini.ts` (they call `buildExplainSystemPrompt(kind)` + `buildExplainWordUserPrompt(request)`); `src/ai/prompts/explain-word.prompt.ts`; `src/content/index.ts` `runExplain`; `src/background/handlers.ts` `explainWord`.
**Steps:**
1. `runExplain` (index.ts) and `explainWord` (handlers.ts) pass `language: settings.targetLanguage` into the `ExplainRequest` (already has `language?`).
2. `buildExplainSystemPrompt(kind, opts?)` accepts an optional user template; if set, substitute tokens (`{{language}}` etc.) and use it; else built-in default.
3. All three adapters pass the template through (read from settings via the request or a param).
**Verify:** unit test proves template token substitution + that targetLanguage reaches the prompt.

## Task 5: Bilingual toggle behaviour
**Files:** `src/content/reading/reader.ts`, `src/content/hover-card.ts`, `src/content/index.ts`.
- When `bilingualMode` is off, the reading overlay / hover card hides the translation/meaning section (show original + saved note only). When on, shows translation in `targetLanguage` (already wired).
- `translate` (TranslatePanel, toolbar) always uses `targetLanguage` (already does).
**Verify:** e2e toggles bilingualMode and asserts hover card shows/hides meaning.

## Risks
- Don't break the JSON-only contract the adapters parse (`toExplanation`); new fields must be optional.
- Keep `targetLanguage` flowing to translate/reading (already correct) — only explain was missing it.
- Editable prompt is user-supplied free text → no eval; pure string substitution. Sanitize nothing, just inject.
- Don't regress VOC-66 (explain/translate error + icons).

## Definition of Done
- Options page has: language picker, bilingual toggle, editable explain-prompt textarea (+ reset).
- Explain output is in the chosen language and includes the richer fields.
- Bilingual toggle controls translation visibility in overlays.
- All gates green; new unit + e2e tests prove persistence, token substitution, and toggle behaviour.
