# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Popup redesign.** New app-bar with a persistent **Bilingual mode** switch (top right) and a single
  Settings entry; the Library, Review, Quiz and Progress tabs were restyled and the WordCard was
  reworked into a translation-first layout with inline Explain and Simplify.
- **Simplified settings.** The Options page is now a one-section-at-a-time sidebar (Providers,
  Appearance, Popup, Bilingual, Data, Reading experience) instead of one long scrolling form.
- **Selection card.** The thin floating toolbar was replaced by a proper card/panel: word + keyless
  translation header and a three-button action row — **Generate** (one AI button that produces the full
  enrichment inline), **Save** and **Copy**.
- **Keyless inline translation.** The selection card and the bilingual reader translate through
  Google's public endpoint with **no AI key**, targeting the user's configured language (previously it
  defaulted to English→English and showed `—`).
- **Single AI button.** The card's separate Explain/Simplify AI actions were collapsed into one
  **Generate** button; the 9-item "More" AI menu was removed from the content layer.
- **Spaced review & quiz.** The popup Review and Quiz tabs are wired into the library workflow.
- **Bilingual reading mode.** Side-by-side / original-first / translation-first / hover / toggle
  layouts, with word-by-word or sentence depth and vocabulary highlighting inside the reader.

### Changed
- Selection, saving, highlighting and inline translation now work with **no API key**; an AI key is only
  needed for the Generate/enrich step.
- `ExplainRequest` and the explain pipeline support kinds `word | phrase | sentence | grammar |
  vocabulary | simplify | summarize | examples | native | related`.
- Reading-mode overlays follow the OS light/dark theme and constrain to narrow viewports.

### Fixed
- **Stale AI result.** Opening a new word while a previous word's AI/translation was in flight no longer
  paints the old content — a per-selection token discards late results (VOC-120).
- **Toast contrast.** The toast used a dark font on its dark variant backgrounds; it now uses a fixed
  dark surface with light text, so success/error toasts are readable on any page theme (VOC-123).
- **Popup bilingual switch missing.** The switch was gated behind `hidden sm:flex` and vanished in narrow
  popup windows; it is now always visible (VOC-125).
- **Translate not working in the card.** The card sent no target language, so the background translated
  English→English and showed `—`; it now falls back to the user's target language (VOC-119).

### Added (prior unreleased batch)
- **Reading-mode accessibility.** In-page overlays (selection toolbar, hover card, toast) now follow the
  OS light/dark theme via `prefers-color-scheme`, constrain themselves to narrow viewports (toolbar
  wraps, toast goes edge-to-edge on small screens, the card scrolls when tall), and the selection
  toolbar implements the ARIA `toolbar` keyboard pattern — arrow keys move focus, Home/End jump, and a
  single tab stop roving tabindex.
- **Keyboard-only selection.** The selection toolbar now also appears when text is selected with the
  keyboard (Shift + arrows), not only with the mouse.
- **Vocabulary integration in reading mode.** Saved words are highlighted across the whole page —
  including bilingual pages where original and translated text sit side by side in two columns.
  Hovering (or keyboard-focusing) a highlight now also shows the IPA **pronunciation** when the entry
  has an explanation, plus an **AI explain** shortcut on the card that requests a fresh explanation
  in place. The selection toolbar's **Save to Vocabulary** button is now live: selecting any word and
  clicking it saves the word straight from the page and highlights it immediately.
- **Reading experience controls.** The hover card over a saved word can hide the original word and/or the
  translation, and its width, font size and spacing are adjustable. Settings apply live to open pages via
  CSS custom properties, so the overlay reflows instantly.
- **Structured paragraph-by-paragraph translation.** Select any text and choose **Translate** from the
  selection toolbar to translate the whole page. The DOM is walked and each paragraph-sized block
  (headings, paragraphs, list items, table cells, block quotes) is translated as its own unit — never
  the page as a single block. Text nodes are translated around `[[n]]` markers, so headings, lists,
  links and inline markup keep every tag and attribute and the page layout is never disturbed; code
  blocks, scripts, form controls and the extension's own nodes are left untouched. The AI call goes
  through the shared provider abstraction (`TranslationService`), so no content-script code touches a
  provider SDK, and it honours the user's target-language setting with per-request fallback.
- **Multi-provider model.** Settings now store a list of saved providers (`providers: SavedProvider[]`)
  with an active provider and an optional fallback, instead of a single provider. Users can add, edit,
  remove and switch between any number of providers from the Options page.
- **More providers.** Added DeepSeek, Mistral, Groq and Together AI (all OpenAI-compatible presets) and a
  `custom` entry for any OpenAI-compatible endpoint (OpenRouter, self-hosted vLLM, corporate gateways,
  local runtimes on non-default ports).
- **Per-provider configuration.** Each saved provider carries its own API key, base URL, model,
  temperature, max tokens and timeout.
- **Fallback.** On a transient failure, `ExplainService` retries once against the configured fallback
  provider before surfacing the error (hard errors like a bad key are not retried).
- **Response caching.** In-memory 24 h cache keyed by provider/model/word/context, so repeated requests
  are free and instant.
- **Connection test.** The Options page can test a saved provider on demand and reports a clear message.

### Changed (prior unreleased batch)
- **Richer page context for AI explanations.** `ExplainRequest` now carries the page title
  (`pageTitle`) and a short excerpt of the text preceding the selection (`precedingText`), captured by
  the content script and passed through the save and explain flows. The prompt includes both, so the
  model can pick the right sense from context.
- **Term preservation.** The explainer prompt instructs the model to keep proper nouns, brand names,
  technical terms and code snippets verbatim — never translating them in the translation or examples.
- The response cache key now includes `pageTitle` and `precedingText`, so the same word on different
  pages is not served a stale explanation.
- `ExplainService` is now the single application entry point for AI: it resolves the active provider,
  applies caching, rate-limiting, retry/backoff and optional fallback. Feature code never references a
  provider SDK.
- Prompts moved into `src/ai/prompts/` (e.g. `explain-word.prompt.ts`) and are imported by the adapters.
- AI error messages are user-facing and never include the API key; the 300-character provider-text
  cap and header masking keep credentials out of logs and surfaces.
- **Accessibility polish pass.** Every interactive control in the popup and options pages now shows
  a visible focus ring when reached by keyboard — including the toast dismiss button, the tag input
  and the reading-experience sliders. The popup's empty library state uses the same book icon as the
  rest of the library instead of a settings gear.

## [0.1.0] — 2026-08-02

First working release. The extension can be loaded in Chrome and every core feature is functional.

### Added

**Capture**
- Save the selected word or phrase from the right-click context menu
- Save with the `Ctrl+Shift+S` / `Cmd+Shift+S` keyboard shortcut
- Save from the popup, which prefills the current page selection
- Each entry records the word, phrase, surrounding sentence, source URL and title, note, tags,
  favourite flag and creation time

**Vocabulary library**
- Debounced search across words, notes, sentences and tags
- Filter by favourites or by tag
- Inline editing, delete with confirmation, favourite toggle
- Normalised, de-duplicated tag management

**Highlighting**
- Saved vocabulary is highlighted on every page, with word-boundary and multi-word phrase matching
- Accessible hover card (also reachable by keyboard) showing meaning, note and saved date
- Dynamic pages handled via a batched `MutationObserver`
- Highlight colour and on/off state apply to open pages immediately

**AI Explain**
- Provider-agnostic abstraction with a shared explanation schema
- Support for OpenAI, OpenRouter, LM Studio, Ollama, Google Gemini and Anthropic
- Generates meaning, simple explanation, examples, synonyms, IPA pronunciation and collocations
- Explanations are cached on the entry and can be refreshed on demand
- Optional automatic explanation when a new word is saved

**Settings and data**
- Provider, API key, model and base URL configuration with a connection test
- Highlight colour picker with live preview and an enable/disable toggle
- Versioned JSON export, and import with merge or replace strategies

**Engineering**
- 174 unit tests (Vitest, jsdom, fake-indexeddb) and 10 Playwright E2E tests against a real Chromium
  running the unpacked extension
- Strict TypeScript, ESLint and a production build enforced as quality gates

### Fixed

- Content script is built as a standalone IIFE; the previous ESM output could not be injected by
  Chrome and failed silently on every page
- Controlled settings inputs no longer flicker or revert while the asynchronous write is in flight
- Live setting changes now reach open pages even when the MV3 service worker has been evicted
- Removed 70 stray compiler-generated `.js` files produced by an incorrect build script
