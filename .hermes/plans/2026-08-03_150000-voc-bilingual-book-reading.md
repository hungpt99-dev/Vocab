# VOC-68 Bilingual-book reading mode for news/articles — Plan

> **For Hermes:** Plan → Linear issue VOC-68 → auto-code via CodingAutomation. Linear is source of truth.

**Goal:** Turn the existing (paragraph-level) reading mode into a **sentence-aligned bilingual "book" view**: each English sentence is paired with its translation on the facing line, like a bilingual book. Target language comes from `settings.targetLanguage` (already wired). Helps language learners read news in two languages.

## Background (verified)
- Reading mode entry: toolbar "More" → "Reading mode" (`ICON_BOOK_OPEN`) → `reader.ts` opens a distraction-free overlay over the article (`extractArticle()` blocks = paragraphs).
- It translates each **paragraph block** as a whole via `translate-article` message → `targetLanguage`, rendered in side-by-side / original-first / translation-first / hover / toggle layouts (`reader.ts:215`).
- `settings.targetLanguage` + `bilingualMode` already exist (VOC-67). `readingExperience` has `showOriginal/showTranslation/width/fontSize/spacing`.
- `translate-article` handler (`handlers.ts`) calls `translateUnit` → provider. Sentence splitting currently happens INSIDE the translation service (`splitIntoSentences`) for per-sentence translation already! So sentences are already translated individually — we just render them grouped by paragraph, not aligned.

## Key insight
The translation layer **already splits into sentences** (`translate-service.ts` `splitIntoSentences`). The blocker is the **render layer**: `BlockRow` shows one paragraph `src` + one `tgt`. To get bilingual-book alignment we need each sentence rendered as its own paired row.

## Quality gates (every task)
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (app+content), `npm run test:e2e`. Icons lucide only.

## Task 1: Sentence-level block model
**Files:** `src/content/reading/reader.ts`, `src/content/reading/types.ts` (if exists) or inline.
- Add an **alignment mode** preference: `'paragraph'` (current) | `'sentence'` (bilingual-book). Stored in `ReadingPreferences` (local, `watchReadingPreferences`/`getReadingPreferences`).
- When `'sentence'`: split each `ArticleBlock.text` into sentences (reuse `splitIntoSentences` from `translate-service`), build one `BlockRow` per sentence (id = `${block.id}#${i}`). Keep paragraph grouping for layout spacing.
- Translation request sends each sentence; responses mapped back by id. (Already per-item, so minimal change to `requestChunk`.)

## Task 2: Bilingual-book render layout
**Files:** `src/content/reading/reader.ts`, `src/content/reading/reader.css` (or styles.ts).
- New `data-align="sentence"` layout: for each sentence row, render `src` (English) and `tgt` (translation) as **stacked facing lines** (English on top, translation directly beneath) — like a bilingual book. In side-by-side mode, the sentence pairs stay vertically aligned.
- Keep existing paragraph layout as default; sentence mode is opt-in via the reading toolbar (a new "Sentence pairs" toggle / lucide `AlignHorizontalJustifyCenter` or `Rows` icon).
- Respect `bilingualMode`: if off, hide `tgt` (show English only).

## Task 3: Word interaction in reading view
**Files:** `src/content/reading/reader.ts`.
- Unknown-word highlighting already applies via `matcher` (`applyHighlights`). Ensure clicking a highlighted word in the reading view opens the explain flow (save + AI explain) — reuse existing `handleSelectionAction` / hover path. (Verify; if missing, wire a click handler to `runExplain`.)

## Task 4: Options + preferences UI
**Files:** `src/features/settings/AppearanceSettings.tsx` (reading prefs live there) or a small reading-prefs control in the reader toolbar.
- Expose alignment choice (paragraph vs sentence) — primary surface = reader toolbar toggle (lucide icon), so it's discoverable while reading news. Optionally mirror in Options under "Reading experience".

## Task 5: Tests
- Unit: `splitIntoSentences` alignment + sentence-row id mapping.
- E2e: open reading mode on `samplePageUrl`, switch to sentence-aligned view, assert each English sentence has a facing translation line; toggle `bilingualMode` off hides translations.

## Risks
- Don't regress paragraph layout (keep as default).
- Sentence splitting must not mangle abbreviations (reuse existing `splitIntoSentences`, don't reinvent).
- Translation is per-sentence already, so cost is similar; lazy-load (IntersectionObserver) preserved.
- Keep `bilingualMode` gating intact.

## Definition of Done
- Reading mode has a "sentence pairs" (bilingual-book) layout that shows each English sentence with its translation on the facing line.
- Uses `targetLanguage` (no hardcoded language).
- Toggle works; `bilingualMode` off hides translations.
- Paragraph layout unchanged.
- All gates green; new unit + e2e pass; lucide icons only.
