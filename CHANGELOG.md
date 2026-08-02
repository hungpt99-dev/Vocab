# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
