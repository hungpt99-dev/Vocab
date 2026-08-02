# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.org/), and the versioning scheme is
[Semantic Versioning](https://semver.org/) (see [Release process](RELEASE_PROCESS.md)).

## [Unreleased]

### Added
- AI resilience: automatic retry with exponential backoff for transient failures, and a shared token-bucket rate limiter so concurrent requests do not burst the provider. Recorded as [ADR-014](DECISION_LOG.md#adr-014--retry-and-rate-limit-only-transient-ai-failures).
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
- Content script styling now reads from the shared token module instead of hardcoded hex values; no
  visible change to end users.

### Fixed
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
