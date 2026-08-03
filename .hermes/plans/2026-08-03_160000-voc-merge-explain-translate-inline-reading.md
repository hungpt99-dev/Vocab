# VOC-69 Merge explain/translate + fix icons + inline bilingual reading — Plan

> **For Hermes:** Plan → Linear VOC-69 → implement directly (CodingAutomation worker is 503-blocked).

## Background (verified)
- Toolbar `TOOLBAR_ACTIONS` has `explain` (Sparkles) + `translate` (Languages) as separate buttons — redundant for a learner (explain already returns translation in targetLanguage since VOC-67).
- Icons are all lucide, but the reading alignment toggle added in VOC-68 uses `AlignVerticalJustifyStart` and reads inconsistently; toolbar explain/translate pairing looks odd.
- VOC-68 built a **separate full-screen reader dialog** (overlay over the article). User wants the **original page kept**, with translations **injected inline** (word/tense next to the original) — like a bilingual book layered on the real site.

## Quality gates (every task)
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (app+content), `npm run test:e2e`. Icons lucide only.

## Task 1: Merge Explain + Translate into one toolbar button
**Files:** `src/content/toolbar.ts`, `src/content/index.ts`, `src/background/handlers.ts` (if translate handler still needed elsewhere), `src/shared/types/*` (toolbar action id types).
- Remove the separate `translate` toolbar action. Keep a single **"Explain"** button (Sparkles) that produces the bilingual explanation (already includes `translation` in targetLanguage).
- Anywhere `translate` toolbar action was handled → route to explain (or remove). Keep `translate-article`/TranslatePanel for the reading inline flow only.
- Update types: `ToolbarActionId` union drops `'translate'` (or remaps). Ensure no dangling handlers.

## Task 2: Fix "weird" icons
**Files:** `src/content/icons.ts`, `src/content/reading/*`.
- Replace the VOC-68 `AlignVerticalJustifyStart` reading toggle with a clearer lucide icon (e.g. `Languages` or `BookOpenText` for bilingual, `AlignLeft` for paragraph) — pick consistent, recognizable ones.
- Ensure the single Explain button uses a single clear lucide icon (Sparkles). No char glyphs, no hand-SVG.

## Task 3: Inline bilingual reading (replace the dialog)
**Files:** `src/content/reading/reader.ts` (or a new `inline-reader.ts`), `src/content/reading/reading-mode.ts`, `src/content/reading/styles.ts`, `src/content/reading/preferences.ts`.
- **Keep the original page UI intact.** Do NOT open a separate overlay/dialog.
- On "Reading mode" (toolbar More → Reading mode), instead inject translations **inline**: for each sentence (or each saved/highlighted word), insert the translation (word + tense/grammar note) adjacent to the original text on the live page, styled subtly (e.g. smaller muted text beneath the sentence, or an inline gloss).
- Use existing `targetLanguage` + `bilingualMode`. Reuse `translate-article` / `splitIntoSentences` (already per-sentence).
- Provide a small floating toggle (lucide) to turn inline translations on/off and switch alignment (paragraph vs sentence) — but the toggle must NOT replace the page; it controls the inline injection.
- Respect `bilingualMode` off → no inline translation shown.

## Task 4: Tests
- Unit: toolbar action set no longer includes `translate`; inline injection maps sentence→translation.
- E2e: open reading mode on samplePageUrl → assert the original page text is still present AND a translation node was injected inline (not a separate dialog). Toggle bilingualMode off → inline translations hidden.

## Risks
- Don't break the explain flow (VOC-66/67) — merging buttons must not lose functionality.
- Inline injection must be removable (cleanup on exit) and not corrupt the page DOM.
- Keep `translate` available for the popup TranslatePanel? User said merge the 2 toolbar buttons; the popup TranslatePanel is a different surface. Keep popup TranslatePanel as-is (it's not a duplicate button on the page). Re-evaluate if user objects.
- Icons lucide only.

## Definition of Done
- Toolbar has ONE AI button (Explain) — no duplicate translate button.
- Icons consistent + lucide.
- Reading mode keeps the original site UI and injects translations inline (word/tense), toggleable, respecting bilingualMode.
- All gates green; new unit + e2e pass.
