# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Bilingual reading mode.** A keyboard shortcut (`Alt+Shift+R`) or the selection toolbar's
  "Translate" action opens an article overlay that translates the page paragraph by paragraph into
  the configured target language, preserving heading structure. Five layouts are supported:
  side-by-side, original-first, translation-first, hover (translation revealed on hover/focus) and a
  global original/translation toggle.
- **Structured paragraph translation.** `TranslateService` is the single application entry point:
  it resolves the configured provider, translates in bounded chunks (8 paragraphs per request),
  applies caching, rate-limiting, retry/backoff and optional fallback, and returns results keyed by
  the caller's paragraph ids. Providers expose a `translate()` capability alongside `explain()`.
- **Lazy loading + caching.** Translations are fetched chunk by chunk as the reader scrolls into each
  section (`IntersectionObserver`), with a "Translate all" control and a per-section retry on
  failure. Translated paragraphs are cached for the session.
- **Reading controls.** Font size (A−/A+), layout selector and a vocabulary-highlight toggle persist
  to `chrome.storage.local` (`avs:reading`) and apply to open readers immediately.
- **Vocabulary integration.** Saved words are highlighted inside the reader using the same matcher
  and hover card as the rest of the extension.
- **Accessibility.** The reader is a focus-managed `role="dialog"` (modal), closes on `Escape`,
  restores focus on close, exposes ARIA labels on every control, and the translated column carries a
  `lang` hint when the target language maps to a BCP-47 tag.

### Changed

- All providers (OpenAI-compatible presets, Gemini, Anthropic) now implement a `translate()`
  capability sharing the same prompt and tolerant JSON parser.
- Explanations and translations share one rate limiter and one retry-once-fallback helper
  (`run-with-fallback.ts`), removing duplicated logic between the two services.
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
