# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.org/), and the versioning scheme is
[Semantic Versioning](https://semver.org/) (see [Release process](RELEASE_PROCESS.md)).

## [Unreleased]

### Added
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
