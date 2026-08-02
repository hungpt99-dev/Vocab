# AI Vocabulary Saver

A lightweight, **local-first** Chrome extension that saves words while you browse, highlights them on
every page you visit, and explains them using **your own AI API key**.

No backend. No account. No cloud. No telemetry. Everything stays in your browser.

[![CI](https://github.com/hungpt99-dev/Vocab/actions/workflows/ci.yml/badge.svg)](https://github.com/hungpt99-dev/Vocab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Architecture overview](#architecture-overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [AI providers](#ai-providers)
- [Usage](#usage)
- [Development setup](#development-setup)
- [Build, test and lint](#build-test-and-lint)
- [Folder structure](#folder-structure)
- [Browser compatibility](#browser-compatibility)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Privacy](#privacy)
- [License](#license)

---

## Why this exists

Most vocabulary is met while reading and lost immediately afterwards. Existing tools ask you to leave
the page, create an account, pay a subscription, or hand over your browsing data.

This extension takes a different position: saving a word costs one keystroke, the word is then
highlighted wherever you browse so recall happens passively, and everything — including which AI model
explains your words — stays under your control.

---

## Features

| Feature | Details |
| --- | --- |
| **Save a selection** | Right-click menu, popup form, or `Ctrl+Shift+S` (`Cmd+Shift+S` on macOS) |
| **Context preserved** | Stores the word, phrase, surrounding sentence, source URL and title, note and creation time |
| **Vocabulary library** | Debounced search, inline edit, delete, favourite and tag |
| **On-page highlighting** | Saved words highlighted everywhere — including both columns of bilingual (original/translation) pages; hover or keyboard-focus shows meaning, pronunciation, note, saved date and an AI-explain shortcut |
| **AI Explain** | Meaning, simple explanation, examples, synonyms, IPA pronunciation and collocations |
| **Page translation** | Translate a page paragraph-by-paragraph; headings, lists, links and code preserved, layout untouched |
| **Bring your own key** | OpenAI, OpenRouter, Google Gemini, Anthropic, Ollama and LM Studio |
| **Portable data** | Versioned JSON export and import, with merge or replace |
| **Accessible** | Keyboard navigable, screen-reader labelled, respects `prefers-reduced-motion` and dark mode |

---

## Screenshots

> Screenshots are not yet captured. Placeholders below mark where they belong; see
> [issue tracker](https://github.com/hungpt99-dev/Vocab/issues) to contribute them.

| Popup — save and library | Options — provider settings | Highlighting on a page |
| --- | --- | --- |
| _`docs/assets/popup.png` (todo)_ | _`docs/assets/options.png` (todo)_ | _`docs/assets/highlight.png` (todo)_ |

---

## Tech stack

| Concern | Choice | Why |
| --- | --- | --- |
| UI | React 18 + TypeScript (strict) | Familiar, well-typed component model |
| Build | Vite | Fast, and multi-entry builds suit an extension's surfaces |
| Platform | Chrome Manifest V3 | Required for new Chrome Web Store submissions |
| Storage | Dexie (IndexedDB) | Structured, indexed, effectively unbounded local storage |
| Settings | `chrome.storage.local` | Readable from every surface, with cross-context change events |
| Styling | TailwindCSS + shared design tokens | Utility CSS for extension pages, tokens shared with injected CSS |
| Unit tests | Vitest + Testing Library + fake-indexeddb | Fast, jsdom-based, no browser needed |
| E2E tests | Playwright | Drives a real Chromium with the unpacked extension loaded |

---

## Architecture overview

Manifest V3 splits an extension into isolated contexts. Four are used, sharing nothing but a typed
message contract and the storage layer:

```
   ┌──────────┐   messages   ┌────────────────────┐
   │  Popup   │◄────────────►│  Service worker    │
   └──────────┘              │  context menu,     │
   ┌──────────┐              │  shortcut, routing,│
   │ Options  │◄────────────►│  AI orchestration  │
   └──────────┘              └─────────┬──────────┘
   ┌────────────────────┐              │
   │  Content script    │◄─────────────┘
   │  select, highlight │
   └────────────────────┘
             │
             ▼
   IndexedDB (vocabulary) · chrome.storage.local (settings) · provider HTTPS
```

Dependencies point one way: presentation → application → domain → infrastructure. Only `src/storage`
touches Dexie; only `src/ai/providers` knows a provider's wire format.

Full detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md).

---

## Installation

### From source

```bash
git clone https://github.com/hungpt99-dev/Vocab.git
cd Vocab
npm install
npm run build
```

Then load it into Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the generated **`dist/`** folder

The icon appears in your toolbar. Open it and choose **Settings** to add your API key.

### From the Chrome Web Store

Not yet published. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Configuration

Open the popup and choose **Settings**, or right-click the extension icon → *Options*.

| Setting | Default | Notes |
| --- | --- | --- |
| Provider | OpenAI | One of six; see below |
| API key | empty | Required by hosted providers, not by local ones |
| Model | provider default | Leave blank unless overriding |
| Base URL | provider default | For proxies, gateways or non-standard ports |
| Highlight saved words | on | Applies to open tabs immediately |
| Highlight colour | `#fde68a` | Applies to open tabs immediately |
| Show original word | on | Hover card heading over a saved word |
| Show translation | on | Hover card meaning block |
| Translation width | `320px` | Hover card max width, `240–480px` |
| Card font size | `13px` | Hover card text, `11–18px` |
| Card spacing | `1.5` | Hover card line-height and row gaps, `1.2–2.0` |
| Explain automatically on save | off | Costs an API call per saved word |

Use **Test connection** to verify a provider before saving words.

---

## AI providers

| Provider | API key | Default model | Notes |
| --- | --- | --- | --- |
| OpenAI | required | `gpt-4o-mini` | |
| OpenRouter | required | `openai/gpt-4o-mini` | Many models behind one key |
| Google Gemini | required | `gemini-1.5-flash` | |
| Anthropic | required | `claude-3-5-haiku-latest` | |
| Ollama | not required | `llama3.1` | Local, `http://localhost:11434/v1` |
| LM Studio | not required | `local-model` | Local, `http://localhost:1234/v1` |

Your key is stored in `chrome.storage.local` and sent only to the provider you select. It never
reaches any server operated by this project — there is not one.

Adding a provider is usually a one-object change: see
[docs/AI_PROVIDER.md](docs/AI_PROVIDER.md).

---

## Usage

**Save a word.** Select text, then right-click → *Save "…" to vocabulary*, press `Ctrl+Shift+S`, open
the popup (the selection is prefilled) and click **Save to vocabulary**, or use the floating
**Save** button that appears above any selection.

**Browse your library.** The popup lists entries newest first. Search matches words, notes, sentences
and tags. Filter by favourites or tag.

**Explain a word.** Click **AI explain** on an entry, or on a hover card over a highlighted word. The
result is cached until you refresh it.

<<<<<<< HEAD
**Highlighting.** Saved words are highlighted as you browse, in both the original and translated text
of bilingual pages. Hover — or tab to a highlight — to see the meaning, pronunciation, your note and
the saved date, plus an **AI explain** shortcut. Press `Escape` to dismiss.
=======
**Translate a page.** Select any text, then click **Translate** on the selection toolbar. Each
paragraph, heading, list item and table cell is translated individually — never the whole page as one
block — so headings, lists, links and code blocks stay intact and the layout is unchanged.

**Highlighting.** Saved words are highlighted as you browse. Hover — or tab to a highlight — to see the
meaning, your note and the saved date. Press `Escape` to dismiss.
>>>>>>> 1bc71b5 (feat(vocab): structured paragraph-by-paragraph page translation)

**Back up.** Settings → *Export JSON*. Restore with *Import JSON* using **merge** (keeps newer entries)
or **replace** (clears first).

---

## Development setup

Requires **Node 20+**. Linux E2E runs also need `xvfb`.

```bash
npm install
npm run dev        # watch build into dist/
```

After a change, press the reload icon on the extension's card at `chrome://extensions`. Popup and
options changes only need the surface reopened.

Full guide, including how to debug each surface: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Build, test and lint

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (zero warnings allowed)
npm run lint:fix     # autofix
npm run format       # prettier
npm run test         # vitest unit + component tests
npm run test:watch   # vitest in watch mode
npm run test:coverage
npm run test:e2e     # builds, then Playwright against a real Chromium
npm run build        # production build
npm run package      # build and zip for distribution
```

Current status: **187 unit tests** across 23 files, **14 E2E tests** across 3 specs, all green.

Chrome extensions cannot run headless, so `test:e2e` wraps Playwright in `xvfb-run` on Linux. See
[docs/TESTING.md](docs/TESTING.md).

---

## Folder structure

```
src/
├── ai/           Provider-agnostic AI layer (adapters, registry, parsing)
├── background/   MV3 service worker: menu, shortcut, routing, orchestration
├── content/      Injected script: selection, highlighting, hover card, toasts
├── features/     Feature-scoped UI (capture, library, settings)
├── shared/       Cross-cutting: hooks, lib, messaging, types, ui, styles/tokens
├── storage/      Dexie schema and repositories — the only Dexie importer
├── popup/        Popup React root and HTML entry
├── options/      Options React root and HTML entry
└── test/         Vitest setup and the chrome API mock
```

Every directory's purpose, ownership and dependency rules:
[docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md).

---

## Browser compatibility

| Browser | Status |
| --- | --- |
| Chrome 110+ | Supported and tested |
| Edge 110+ | Expected to work (Chromium, MV3); not routinely tested |
| Brave, Opera, Vivaldi | Expected to work; not tested |
| Firefox | Not yet — needs manifest changes and its own E2E matrix |
| Safari | Not planned |
| Chrome on Android/iOS | Not possible; mobile Chrome does not support extensions |

`minimum_chrome_version` is `110`, required for the Unicode regex lookbehind used in matching.

---

## FAQ

**Is my data sent anywhere?**
No. Vocabulary stays in IndexedDB in your browser profile. The only outbound requests are AI calls you
trigger, sent directly to the provider you configured.

**Do I need an API key?**
Only for AI explanations, and only for hosted providers. Saving, searching and highlighting all work
with no key. Ollama and LM Studio need no key at all.

**What does it cost?**
The extension is free and MIT licensed. You pay your AI provider directly for what you use, or nothing
if you run a local model.

**Can I sync between computers?**
Not automatically — that is a deliberate non-goal. Export JSON on one machine and import on another.

**Why does highlighting not work on some pages?**
Chrome forbids content scripts on `chrome://` pages, the Chrome Web Store, and the built-in PDF
viewer. This is a browser restriction.

**Will it slow down my browsing?**
Matching compiles your whole vocabulary into a single regex and scans each text node once, with
dynamic content batched onto idle time. Very large pages still cost some CPU; see
[docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).

**Can I use a local model?**
Yes. Ollama and LM Studio are supported and require no key, so nothing leaves your machine at all.

---

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Nothing is highlighted | Check highlighting is enabled in Settings; reload the tab; confirm the page is not `chrome://` or the Web Store |
| Shortcut does nothing | Another extension may have claimed it. Reassign at `chrome://extensions/shortcuts` |
| "Select a word first" | The page reported no selection. Select text, then trigger the save |
| `missing_api_key` | Add a key in Settings, or switch to Ollama/LM Studio |
| `unauthorized` | Key is wrong, revoked, or lacks access to the chosen model |
| `rate_limited` | Provider throttled you. Wait, or switch model — there is no automatic retry yet |
| Local provider unreachable | Confirm Ollama or LM Studio is running and the base URL matches |
| Changes not appearing after a rebuild | Press reload on the card at `chrome://extensions` |
| E2E tests fail immediately on Linux | Install `xvfb`; extensions cannot run headless |
| Build output stale | `rm -rf dist && npm run build` |

Still stuck? Open an issue with the console output from the affected surface (popup, options, the
service worker via `chrome://extensions`, or the page). **Redact your API key.**

---

## Roadmap

Shipped in v0.1.0: capture, library, highlighting, AI explain, settings and data portability.

Next candidates, in priority order: spaced-repetition review mode, pronunciation audio, bulk library
operations, streaming explanations, per-site highlight lists, CSV/Anki export.

Deliberately deferred: cloud sync, a Firefox port, any project-supplied API key. Reasoning in
[docs/ROADMAP.md](docs/ROADMAP.md).

---

## Documentation

Full documentation lives in [`docs/`](docs/README.md).

| Start here | Document |
| --- | --- |
| What and why | [Project overview](docs/PROJECT_OVERVIEW.md) · [Product requirements](docs/PRODUCT_REQUIREMENTS.md) |
| How it is built | [Architecture](docs/ARCHITECTURE.md) · [System design](docs/SYSTEM_DESIGN.md) · [Folder structure](docs/FOLDER_STRUCTURE.md) |
| Why it is built that way | [Decision log](docs/DECISION_LOG.md) |
| Subsystems | [AI providers](docs/AI_PROVIDER.md) · [Storage](docs/STORAGE.md) · [Security](docs/SECURITY.md) |
| Standards | [Coding standards](docs/CODING_STANDARDS.md) · [Design system](docs/DESIGN_SYSTEM.md) · [API guidelines](docs/API_GUIDELINES.md) |
| Working here | [Development](docs/DEVELOPMENT.md) · [Testing](docs/TESTING.md) · [Contributing](docs/CONTRIBUTING.md) |
| Shipping | [Deployment](docs/DEPLOYMENT.md) · [Release process](docs/RELEASE_PROCESS.md) · [Changelog](docs/CHANGELOG.md) |
| For AI agents | [AI agent rules](docs/AI_AGENT_RULES.md) · [AI workflow](docs/AI_WORKFLOW.md) |

---

## Contributing

Contributions are welcome. Read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for branch naming, commit
conventions, the review checklist and the Definition of Done.

Every change must pass typecheck, lint, unit tests, E2E tests and the production build, and must leave
the documentation more accurate than it found it.

---

## Privacy

- Vocabulary is stored in IndexedDB inside your browser profile.
- Settings, including your API key, are stored in `chrome.storage.local`.
- The only outbound requests are AI calls you trigger, sent directly to your chosen provider.
- No analytics, no telemetry, no crash reporting, no third-party scripts.

Threat model and the honest limitations of storing a key locally:
[docs/SECURITY.md](docs/SECURITY.md).

---

## License

[MIT](LICENSE)
