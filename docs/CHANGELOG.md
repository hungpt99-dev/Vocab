# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.org/), and the versioning scheme is
[Semantic Versioning](https://semver.org/) (see [Release process](RELEASE_PROCESS.md)).

## [Unreleased]

### Added
- **Pronunciation / speaker button (VOC-142):** a reusable `PronunciationButton`
  (`src/features/pronunciation/PronunciationButton.tsx`) plays a saved word's
  pronunciation in its *own* language. It is wired into the library `EntryCard`
  and the popup `WordCard` (next to the word). Language is taken from the entry's
  existing `sourceLanguage` metadata (reusing `toLocale()` from `language-codes.ts`
  to expand a name/code to a BCP-47 locale), never hardcoded to English.
- **On-page hover card now has the speaker too:** the reading-overlay tooltip that
  appears on a highlighted word on any webpage mounts the *same* `PronunciationButton`
  (reusing the shared `pronunciationService`), so pronunciation works wherever a
  saved word is shown — not just the library and popup. Required plumbing: added
  `sourceLanguage` to the highlight payload (`HighlightData`/`buildHighlightData`)
  so the on-page card knows the word's language (no new language field; reuses the
  existing `VocabularyEntry.sourceLanguage`). The card speaker is styled to match
  the existing overlay (`.avs-card-speaker-btn`).
- **`PronunciationService`** (`src/features/pronunciation/pronunciation-service.ts`):
  wraps the browser `SpeechSynthesis` API. Owns voice selection (exact locale →
  same-language family → none), speech lifecycle, cancellation, capability
  detection and error handling. A shared singleton guarantees only one utterance
  plays at a time; starting another word cancels the current one. Voice selection
  never falls back to an unrelated language — if no matching voice exists the
  button shows a graceful "pronunciation unavailable" state instead of mispronouncing.
  Uses `lucide-react` icons only (`Volume2` idle/playing, `Loader2` loading,
  `VolumeX` error) — no emoji/unicode.

### Fixed
- **Bilingual re-translation on reopen (VOC-141):** reopening a translated page (reload, or switching
  tabs away and back) no longer re-runs the whole translation pipeline. A per-session cache
  (`src/content/reading/translation-cache.ts`, backed by `chrome.storage.session`) stores each
  translated unit keyed by `sourceText + targetLanguage + mode`, so a reopened page reuses the prior
  translation instantly — no second AI call, no skeleton flash. New or changed content still translates
  fresh. The in-memory `translatedBlockIds` guard remains as the per-session fast path.

### Added
- **Vocabulary normalization pipeline (VOC-140):** saving a word now runs it through a
  normalization → linguistic-analysis pipeline that resolves a canonical lemma and word-family (`familyId`)
  and de-duplicates by `(userId, familyId)`. The linguistic stage is AI-backed (prompted in the word's own
  language, no English-only rules) and degrades gracefully to a non-destructive identity when no AI
  provider is configured. `VocabularyEntry` gains `surfaceForm`, `normalizedForm`, `lemma`, `familyId`,
  `partOfSpeech` and `userId`; the DB adds a unique `[userId+familyId]` index so concurrent saves cannot
  create duplicate concepts.
- Chrome Web Store release assets: `docs/STORE_LISTING.md` (paste-ready listing
  copy), `docs/PRIVACY.md` (complete data-use disclosure + store-form answers),
  and `store-assets/` (1280×800 screenshots plus a 1400×560 banner and 440×280
  tile, generated from the real build by `scripts/store-screenshots.mjs`).
- Cross-platform packaging script `scripts/package.mjs` (PowerShell
  `Compress-Archive` on Windows, `zip` elsewhere); `npm run package` no longer
  requires the `zip` binary and always recreates the archive from scratch.
- Smart AI assistance on a selected/translated sentence: the selection toolbar's "More" menu exposes
  Explain sentence, Explain grammar, Explain vocabulary, Simplify, Summarize and Save difficult words.
  Each analysis routes through the provider-agnostic `ExplainService` (with a dedicated prompt per
  kind) and the result opens in a dismissible panel; "Save difficult words" extracts the hard terms
  and persists each to the vocabulary library.
- Vocabulary integration in reading mode: saved words are highlighted in both the original and the
  translated column of bilingual pages; the hover card shows the IPA pronunciation (when available),
  note, saved date and an in-place **AI explain** shortcut; and the selection toolbar's **Save to
  Vocabulary** button persists the selected word straight from the page. The AI request is routed
  through the provider-agnostic `ExplainService` in the background worker — the content script never
  couples to a provider.
- **Reading experience controls.** The hover card over a saved word can now hide the original word and/or
  the translation, and its width, font size and spacing are adjustable. Settings apply live to open pages
  via CSS custom properties (`--avs-card-width`, `--avs-card-font-size`, `--avs-card-spacing`), so the
  overlay reflows instantly.
- AI resilience: automatic retry with exponential backoff for transient failures, and a shared token-bucket rate limiter so concurrent requests do not burst the provider. Recorded as [ADR-014](DECISION_LOG.md#adr-014--retry-and-rate-limit-only-transient-ai-failures).
- New runtime dependency `react-window` (virtualized lists) with `@types/react-window`.
- Complete documentation suite under `docs/`: overview, requirements, architecture, system design,
  decision log, coding standards, design system, folder structure, API guidelines, AI provider, storage,
  security, testing, development, deployment, release process, contributing, roadmap, known limitations.
- Rules and workflow for AI coding agents: `docs/AI_AGENT_RULES.md` and `docs/AI_WORKFLOW.md`.
- Root project files: `LICENSE` (MIT), `.editorconfig`, `.gitattributes`, `.github/` (CI, PR and issue
  templates, Dependabot), `.vscode/`.
- A single design-token module (`src/shared/styles/tokens.ts`) shared by Tailwind and the injected
  content stylesheet, enforced by a drift test.
- CI workflow running typecheck, lint, unit tests, build and Playwright E2E in parallel jobs.

### Changed
- **UI/UX polish pass** to meet the production UI standard:
  - Added `lucide-react` as the icon library; replaced every emoji/unicode/text glyph (★ ☆ ✎ 🗑 ×) with real Lucide icons (favorite, edit, delete, search, settings, download/upload, star).
  - Added a reusable design system: `Dialog` (focus-trapped modal, used for delete confirmation), `Toast` (provider + `useToast` hook, replaces all inline status paragraphs), `Badge` (tags), `Checkbox` (settings), `Skeleton`/`SkeletonList` (loading state), and an upgraded `EmptyState` with icon + CTA.
  - Consistent `focus-visible` ring (brand token) on every interactive control — buttons, icon buttons, inputs, selects, checkboxes, links.
  - Semantic status colours centralized as `tints`/`statusSurface` token maps; raw `red`/`green`/`amber` literals removed from components.
  - Brand mark (gear in a tinted tile) added to the popup and options headers for visual consistency.
- Library list is now virtualized (`react-window`) so large vocabularies render only visible cards; rows re-measure on expand/edit via ResizeObserver.
- The delete confirmation is now a portaled modal (`createPortal`) rendered above the UI, so it is never trapped inside a virtualized row.
- Content script styling now reads from the shared token module instead of hardcoded hex values; no visible change to end users.

### Fixed
- Bilingual reading on a second tab showing the same article as the first
  stayed blank: the align cache was keyed by text but returned the first
  requester's block ids, so every lookup missed. Cached results are now
  re-keyed to the caller's ids (VOC-124, `translate-service.ts`).
- AI calls now retry transient failures and are rate-limited; previously a transient 429/5xx failed immediately.
- Content script emitted as ESM (silent highlighting failure) — now built as a standalone IIFE.
- Settings checkbox reverted mid-interaction — now applied optimistically.
- Live setting changes did not reach open tabs when the service worker was evicted — content scripts now
  observe `chrome.storage.onChanged` directly.
- Removed stray compiler-generated `.js` files that had been committed.

---

## [0.1.0] - 2026-08-02

First functional release.

### Added
- **Capture**: save a selected word or phrase via context menu, keyboard shortcut (`Ctrl/Cmd+Shift+S`),
  or the popup form. Stores word, phrase, sentence, source URL, title, note, tags and timestamp.
- **Library**: debounced search, inline edit, delete, favourite and tag.
- **Highlighting**: saved words highlighted on every page; an accessible hover card shows meaning, note
  and date. Works with keyboard focus and mouse, dismissible with `Escape`.
- **AI Explain**: meaning, simple explanation, examples, synonyms, pronunciation and collocations from
  OpenAI, OpenRouter, Google Gemini, Anthropic, Ollama and LM Studio. Results are cached on the entry.
- **Settings**: provider, API key, model, base URL, highlight toggle and colour, auto-explain toggle,
  and a connection test.
- **Data portability**: versioned JSON export and import with merge or replace.
- **Storage**: Dexie-backed vocabulary with unique-key de-duplication and normalised tags.
- **Tests**: 187 unit/component tests and 14 Playwright E2E tests, all green.
- **CI**: typecheck, lint, unit tests, build and E2E.

[Unreleased]: https://github.com/hungpt99-dev/Vocab/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/hungpt99-dev/Vocab/releases/tag/v0.1.0
