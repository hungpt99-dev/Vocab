# Architecture

vocab is a Chrome **Manifest V3** extension built with React, TypeScript and Vite.
It follows a clean, feature-oriented layering: UI depends on application services, which depend on
storage and provider abstractions — never the reverse.

---

## Extension surfaces

MV3 splits an extension into isolated execution contexts. This project uses four:

| Surface | Entry point | Runs in | Responsibility |
| --- | --- | --- | --- |
| **Service worker** | `src/background/index.ts` | Extension worker | Context menu, keyboard command, message routing, AI orchestration |
| **Content script** | `src/content/index.ts` | Every web page | Selection reading, highlighting, hover card, toasts |
| **Popup** | `src/popup/` | Extension page | Save form and vocabulary library |
| **Options** | `src/options/` | Extension page | Provider, key, appearance, import/export |

They share nothing but the typed message contract and the storage layer.

---

## Folder layout

```
src/
├── ai/                     Provider-agnostic AI layer
│   ├── providers/            One adapter per API dialect
│   ├── registry.ts           id → provider lookup
│   ├── explain-service.ts    Application entry point for explanations
│   ├── prompt.ts             Shared system/user prompts
│   ├── parse.ts              Tolerant JSON → Explanation coercion
│   ├── http.ts               postJson with timeout/abort/error normalisation
│   └── types.ts              AiProvider, AiError, ExplainRequest
│
├── background/             Service worker
│   ├── index.ts              Chrome event wiring (menu, commands, install)
│   └── handlers.ts           Pure, dependency-injected message handlers
│
├── content/                Injected page script
│   ├── matcher.ts            Compiles saved words into one boundary regex
│   ├── highlighter.ts        Safe text-node walking and mark wrapping
│   ├── hover-card.ts         Accessible tooltip with viewport clamping
│   ├── selection.ts          Reads selection + surrounding sentence
│   ├── toolbar.ts            Floating selection toolbar with a 'More' menu
│   ├── reading-mode.ts       Bilingual article overlay with five switchable layouts
│   ├── styles.ts             Injected CSS and the highlight colour variable
│   ├── toolbar.ts            Floating action bar on selection, with unit detection
│   ├── explain-popover.ts    Expandable, per-unit "Explain with AI" panel
│   └── toast.ts              Transient status messages
│
├── features/               Feature-scoped UI
│   ├── capture/SaveForm.tsx
│   ├── library/              EntryCard, LibraryList, LibraryToolbar, ExplanationView
│   └── settings/             ProviderSettings, AppearanceSettings, DataSettings, backup.ts
│
├── shared/                 Cross-cutting, feature-agnostic code
│   ├── hooks/                useVocabulary, useSettings, useDebouncedValue
│   ├── lib/                  text, id, result helpers
│   ├── messaging/            contract, router, client
│   ├── types/                Domain models
│   ├── ui/                   Accessible primitives
│   └── styles/               Tailwind entry
│
├── storage/                Persistence boundary
│   ├── database.ts           Dexie schema
│   ├── vocabulary-repository.ts
│   └── settings-repository.ts
│
├── popup/  options/        React roots and HTML entry points
└── test/                   Vitest setup and the chrome API mock
```

---

## Data flow

**Saving a word**

```
selection → content script (readSelection)
          → service worker (saveSelection)
          → VocabularyRepository.save   [IndexedDB]
          → broadcast 'vocabulary-changed'
          → popup reloads, content scripts re-highlight
```

**Explaining a word**

```
content script (toolbar "Explain with AI") → ExplainPopover (calls AI only on click)
          → sendMessage('explain', full context: word, unit, surrounding paragraph,
              page title, URL, detected source language)
          → service worker → ExplainService
          → registry.getProvider(settings.provider)
          → provider.explain()  [direct HTTPS to the provider]
          → parse.toExplanation()
          → cached on the entry, broadcast to all surfaces
```

The content popover never talks to a provider: it sends the full `ExplainRequest` over the typed
message bus, and `ExplainService` resolves the provider, rate-limiting, retry, fallback and the
user's preferred (target) language from settings.

**Highlighting a page**

```
content script → get-highlight-data → { enabled, color, entries }
               → VocabularyMatcher (single regex, longest-match-first)
               → highlightRoot() walks text nodes, wraps in <mark>
               → MutationObserver + requestIdleCallback for dynamic pages
```

---

## Key design points

**Storage is a boundary, not a detail.** `VocabularyRepository` is the only code that touches Dexie.
Its methods speak domain types, so the persistence engine could be swapped without touching the UI.
Word keys are normalised (lowercased, whitespace-collapsed) and uniquely indexed, which makes
"save the same word twice" a merge rather than a duplicate.

**One AI interface, many dialects.** Every provider implements `AiProvider.explain()`. Because OpenAI,
OpenRouter, LM Studio and Ollama all speak the chat-completions dialect, they share a single adapter
parameterised by a preset; only Gemini and Anthropic need bespoke adapters. All failures are
normalised into `AiError` with a stable code, so the UI never branches per provider.

**Messages are typed and total.** `dispatch()` maps every inbound message to a handler and converts
every outcome — success, thrown error, unknown type, malformed payload — into a `MessageResult`.
Handlers are pure functions over injected dependencies, which is why they are unit-testable without a
browser.

**Highlighting is defensive.** The matcher builds one Unicode-aware, word-boundary regex sorted
longest-first, so `piece of cake` wins over `cake` and `cupcakes` never matches. The walker skips
scripts, styles, inputs, code blocks and contenteditable regions, collects target nodes before
mutating (a live TreeWalker would be invalidated mid-traversal), and refuses to descend into existing
highlights, making repeat scans idempotent.

**The content script is a classic script.** Chrome does not allow ES module syntax in content scripts,
so `vite.content.config.ts` builds it separately as a single self-contained IIFE.

**Settings are observed, not relayed.** The content script subscribes to `chrome.storage.onChanged`
directly rather than waiting for a broadcast, because an MV3 service worker may be asleep when the
user changes a preference.

---

## Testing strategy

| Layer | Tool | Coverage |
| --- | --- | --- |
| Pure logic, repositories, adapters, DOM utilities | Vitest + jsdom + fake-indexeddb | 174 unit tests |
| React components | Testing Library | Behaviour and accessible names, never implementation details |
| Full extension | Playwright | 10 specs driving a real Chromium with the unpacked extension |

E2E fixtures are served over local HTTP because content scripts registered for `<all_urls>` are not
injected into `data:` URLs.
