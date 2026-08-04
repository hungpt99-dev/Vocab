# VOC-74: Interlinear word-by-word bilingual gloss + UX/layout polish

> **For Hermes:** Implement task-by-task, verify gates (typecheck/lint/dual build/unit/e2e) along the way.

**Goal:** Add true interlinear bilingual reading — each source word shows its target-language gloss inline (I/Tôi, am/là, a/một, student/học sinh) — and polish the general UI/layout so it is easy to use and visually reasonable.

**Architecture:** A new AI "word-align" mode returns a structured word-by-word alignment per paragraph. The content script renders it as interlinear gloss spans (original word with a small gloss beneath). Sentence-level translation remains the fallback. UI polish touches the popup header, headbar, inline control, and adds a compact inline glossary tooltip on hover.

**Tech Stack:** TS, MV3, lucide-react (popup) / lucide-static (content), vitest + Playwright.

---

### Task 1: AI word-align mode (types + prompt + parse)
- **Files:** `src/ai/types.ts`, `src/ai/prompts/translate.prompt.ts`, `src/ai/parse-translation.ts`, `src/ai/translate-service.ts`
- Add to `types.ts`:
  - `WordPair { source: string; target: string }`
  - `WordAlignResult { id: string; text: string; pairs: WordPair[]; translation: string }` (translation = full-sentence fallback)
  - `TranslateRequest` gains optional `mode?: 'sentence' | 'word'`.
  - `AiProvider` gains `align(request: TranslateRequest & { mode: 'word' }, config: ProviderConfig): Promise<WordAlignResult>` — but to avoid breaking 3 adapters, instead add a **single new adapter method** `align` on the interface and implement it in the base openai-compatible + anthropic + gemini by reusing `complete()` with a word-align prompt.
- Prompt (`translate.prompt.ts`): add `ALIGN_SYSTEM_PROMPT` instructing JSON `{"pairs":[{"source":"I","target":"Tôi"}]}` preserving order, one entry per token, proper nouns/numbers keep target natural. `buildAlignUserPrompt`.
- `parse-translation.ts`: add `parseWordPairs(json): WordPair[]`.
- `translate-service.ts`: add `alignWords(paragraphs, language): Promise<WordAlignResult[]>` reusing cache/retry/fallback; routes to provider `align`.

### Task 2: Wire provider `align` method (3 providers)
- **Files:** `src/ai/providers/openai-compatible.ts`, `anthropic.ts`, `gemini.ts`, `src/ai/types.ts` (interface), `src/ai/registry.ts` (none needed)
- Each provider: implement `align(req, config)` by calling its `complete()` with ALIGN_SYSTEM_PROMPT + buildAlignUserPrompt, parse pairs. Keep existing `translate` unchanged.
- **Tests:** extend `providers.test.ts` to assert `align` returns pairs.

### Task 3: Message contract + background handler for word-align
- **Files:** `src/shared/messaging/contract.ts`, `src/background/handlers.ts`
- Add `{ type: 'align-words'; payload: { paragraphs: TranslationParagraphPayload[]; language: string } }` and `ResponseMap['align-words']: WordAlignResult[]`.
- In `handlers.ts`: handle `align-words` → `deps.translate.alignWords(...)`.

### Task 4: Content: interlinear gloss rendering
- **Files:** `src/content/reading/inline-reader.ts`, `src/content/reading/gloss.ts` (new), `src/content/styles.ts`
- New `src/content/reading/gloss.ts`: builds DOM for interlinear gloss from `WordPair[]`:
  - container `.avs-gloss` (display:inline-block, vertical-align:baseline)
  - `.avs-gloss-source` (original word) + `.avs-gloss-target` (small, muted, beneath)
  - Reuse `makeTranslationNode` fallback (sentence translation) when no pairs.
- `inline-reader.ts`:
  - `injectAll`: for each item, request BOTH sentence translation (existing) AND word pairs (`sendMessage({type:'align-words',...})`). Render gloss when pairs present, else sentence block.
  - Keep alignment (sentence/paragraph) behavior.
- CSS: `.avs-gloss`, `.avs-gloss-source`, `.avs-gloss-target` using token vars (no hex); target is 0.8em, muted color, line under source; subtle background so it reads as a learning aid.

### Task 5: UI polish — popup header, headbar, inline control
- **Files:** `src/popup/App.tsx`, `src/popup/App.css` (or styles.ts for content), `src/content/bilingual-bar.ts`, `src/content/reading/inline-reader.ts`
- Popup header: ensure Switch + Languages icon label aligned, add spacing, consistent heights.
- Headbar: keep sticky; ensure label truncation; subtle hover on close.
- Inline control (bottom-right): group buttons with a clearer label; add a `BookOpen` icon; ensure it doesn't overlap content (already bottom-right, fine). Possibly add a small "Gloss"/"Sentence" mode toggle button (lucide `AlignHorizontalSpaceBetween`/`BookOpen`). Keep minimal.
- General: ensure focus-visible outlines, consistent radii via `radius` tokens.

### Task 6: Compact inline glossary tooltip on gloss hover (nice-to-have)
- Reuse existing `HoverCard` to show the gloss's target word + saved meaning when hovering a `.avs-gloss-source` that matches a saved word. Optional; include only if clean.

### Task 7: Tests + gates
- **Tests:** `inline-reader.test.ts` (or new `gloss.test.ts`) for interlinear DOM; `providers.test.ts` align; contract typecheck.
- **e2e:** extend vocabulary.spec.ts bilingual test to assert `.avs-gloss` appears when a provider is stubbed (use the existing no-provider path → expect sentence fallback `.avs-inline-translation`, and a stubbed align path → expect `.avs-gloss`). Keep e2e green without API keys (use sentence fallback by default; the word-align e2e only asserts structure when a fake provider is injected — out of scope if complex; at minimum assert no regressions).
- **Gates (must all pass):** `npm run typecheck`, `npm run lint`, `npm run build:app`, `npm run build:content`, `npm test`, `npm run test:e2e`.

### Risks / notes
- Word-align quality depends on the model; always keep sentence-level fallback so the feature degrades gracefully (no API key / failure → sentence block).
- Token cost: word-align is more tokens than sentence translation. Cache aggressively (already cached by provider+model+lang+text).
- User said "Improve UX/layout" generally — keep changes tasteful and consistent with existing tokens; no emoji/unicode glyphs, lucide only.
- This is applied to the OPEN page only (content script), same as current bilingual reading.

### Acceptance
- Enabling bilingual mode shows interlinear glosses (word-by-word) beneath source text where the AI returns pairs; falls back to sentence translation otherwise.
- Glosses render inline, readable, not overlapping; headbar/controls are clean and non-overlapping.
- All gates green; lucide icons only; no hardcoded colors.
