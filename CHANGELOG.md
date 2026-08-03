# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

### Changed
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
