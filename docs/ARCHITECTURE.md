# Architecture

This document explains the shape of the system and, for each significant choice, why it exists.
For runtime mechanics — algorithms, sequencing, lifecycle — see [System design](SYSTEM_DESIGN.md).
For the record of decisions and their trade-offs, see the [Decision log](DECISION_LOG.md).

---

## Overall architecture

vocab is a Chrome **Manifest V3** extension. It has no server component. Everything
runs inside the browser profile, and the only outbound traffic is the AI request the user triggers,
sent directly from their browser to the provider they configured.

The system is layered. Dependencies point in one direction only:

```
        ┌─────────────────────────────────────────────┐
        │  Presentation   popup/  options/  features/ │  React, Tailwind
        └───────────────────────┬─────────────────────┘
                                │ hooks, message client
        ┌───────────────────────▼─────────────────────┐
        │  Application    background/handlers         │  orchestration, pure functions
        │                 ai/explain-service          │
        │                 ai/translate-service        │
        └───────────────────────┬─────────────────────┘
                                │ interfaces
        ┌───────────────────────▼─────────────────────┐
        │  Domain         shared/types  shared/lib    │  models, pure helpers
        └───────────────────────┬─────────────────────┘
                                │
        ┌───────────────────────▼─────────────────────┐
        │  Infrastructure storage/ (Dexie)            │  IndexedDB, chrome.storage,
        │                 ai/providers/ (HTTP)        │  network
        └─────────────────────────────────────────────┘
```

**Why layered rather than flat.** The two volatile parts of this product are the storage engine and
the set of AI providers. Both are placed at the bottom behind interfaces, so churn there — a new
provider, a schema change — does not propagate upward into the UI. The rule that enforces this is
mechanical and checkable: only `src/storage` may import Dexie, and only `src/ai/providers` may know a
provider's wire format.

---

## Component diagram

MV3 splits an extension into isolated execution contexts that share no memory. Four are used:

```
   ┌──────────────┐   chrome.runtime    ┌───────────────────────────┐
   │   Popup      │◄───────messages────►│                           │
   │  (React)     │                     │   Service worker          │
   └──────────────┘                     │   src/background/         │
                                        │                           │
   ┌──────────────┐                     │  • context menu           │
   │  Options     │◄───────messages────►│  • keyboard command       │
   │  (React)     │                     │  • message router         │
   └──────────────┘                     │  • AI orchestration       │
                                        └────────┬──────────────────┘
   ┌──────────────────────────┐                  │ tabs.sendMessage
   │  Content script          │◄─────────────────┘
   │  src/content/            │
   │  • read selection        │        ┌──────────────────────────┐
   │  • highlight DOM         │        │ Shared infrastructure    │
   │  • hover card, toast     │        │ storage/ (IndexedDB)     │
   └──────────────────────────┘        │ chrome.storage.local     │
                                       │ ai/ → provider HTTPS     │
   All four surfaces reach ───────────►└──────────────────────────┘
   infrastructure directly.
```

| Surface | Entry point | Lifetime | Responsibility |
| --- | --- | --- | --- |
| Service worker | `src/background/index.ts` | Event-driven; evicted when idle | Context menu, keyboard command, message routing, AI orchestration, broadcasts |
| Content script | `src/content/index.ts` | Per page, from `document_idle` | Selection reading, highlighting, hover card, toasts |
| Popup | `src/popup/` | While open | Save form and vocabulary library |
| Options | `src/options/` | While open | Provider, key, appearance, import/export |

**Why the service worker holds orchestration.** Capture can be initiated from a context menu or a
keyboard shortcut, neither of which has a UI. The worker is the only context guaranteed to exist for
those events, so it owns the flow and notifies the page afterwards.

**Why the content script is not trusted with business logic.** It runs inside arbitrary third-party
pages. Its job is limited to reading a selection and manipulating the DOM. It holds no API key and
makes no provider calls.

---

## Feature modules

Code is grouped by feature, not by technical kind. A folder of `components/`, `hooks/`, `utils/`
forces a change to one feature to touch every folder; feature grouping keeps a change local.

| Module | Path | Contains |
| --- | --- | --- |
| Capture | `src/features/capture/` | `SaveForm` — the popup's save UI |
| Library | `src/features/library/` | `LibraryList`, `LibraryToolbar`, `EntryCard`, `ExplanationView` |
| Settings | `src/features/settings/` | `ProviderSettings`, `AppearanceSettings`, `DataSettings`, `backup.ts` |
| Radar | `src/features/radar/` | `RadarPanel`, `RadarVocabularyService`, `chunk`, `validate`, `rank`, `cache` (goal text lives in Settings, not Dexie) |

Anything used by more than one feature moves to `src/shared/`. **`src/shared` must never import from
`src/features`** — that would create a cycle and make `shared` un-reusable. See
[Folder structure](FOLDER_STRUCTURE.md) for the full dependency rules.

---

## Data flow

**Saving a word** (context-menu route; the shortcut route is identical after the first step)

```
user selects text, right-clicks
  → service worker: contextMenus.onClicked
  → asks the active tab for context        [get-selection → content script]
  → saveSelection(deps, payload)
  → VocabularyRepository.save()            [IndexedDB, upsert on wordKey]
  → toast shown on the page                [show-toast → content script]
  → broadcast 'vocabulary-changed'
  → popup reloads its list; content scripts re-highlight
```

The worker asks the page for context rather than trusting `info.selectionText` alone, because the
context menu supplies the selected text but not the surrounding sentence.

**Explaining a word**

```
popup → sendMessage('explain', { word, context })
      → service worker → ExplainService
      → registry.getProvider(settings.provider)
      → provider.explain()                 [HTTPS, direct to the provider]
      → parse.toExplanation()              [tolerant coercion]
      → cached onto the entry              [IndexedDB]
      → result returned to the popup
```

**Highlighting a page**

```
content script loads (document_idle)
  → injectStyles(), attach listeners, subscribe to chrome.storage
  → request 'get-highlight-data' → { enabled, color, entries }
  → VocabularyMatcher compiles one regex from all words
  → highlightRoot() walks text nodes, wraps matches in <mark>
  → MutationObserver keeps dynamic content highlighted
```

**Finding goal vocabulary (Vocabulary Radar)**

```text
user sets a learning goal in Settings → "Vocabulary Radar"
  → opens the popup, clicks "Find for my Radar"   (or Radar auto-finds on page load)
  → popup → sendMessage('radar:scan')
  → background → radarScan() → sendToTab(activeTab, 'radar:scan')
  → content script → runRadarScanHere()
      • reads clean page text locally   [extractArticle()]
      • sendMessage('radar:analyze', { goal, pageUrl, pageText })
  → worker → RadarVocabularyService.analyzePage()
      • chunks text on paragraph/sentence boundaries  [chunk.ts]
      • per chunk: provider.complete(radar system prompt, user prompt)   [shared AI pipeline, BYOK]
      • validates + coerces candidates (present in text, score 0–100)   [validate.ts]
      • merges / dedupes / ranks by score, keeps Top N (≥70)            [rank.ts]
      • caches by normalised URL + goal text + content hash             [cache.ts]
  → ranked candidates returned to the page → highlighted inline (avs-radar-highlight)
  → also returned to the popup for Explain / Save / Ignore (reuses existing flows)
```

The natural-language goal text lives in Settings (`settings.radar.goal`) and is the source of truth.
Auto-find is on when `radar.autoScan` is enabled (or when Bilingual mode is enabled) and a goal is set.
Unlike the original manual-only design, Radar auto-scans the current page on load when enabled.

---

## Dependency flow

Allowed directions, from most to least abstract:

```
popup / options / features
        │
        ├──► shared/hooks ──► shared/messaging ──► (chrome.runtime)
        │                └──► storage           ──► Dexie / chrome.storage
        │
background ──► ai ──► ai/providers ──► (HTTPS)
        └────► storage

shared/* depends only on shared/* and platform APIs.
```

Rules enforced by review and by the structure itself:

| Rule | Reason |
| --- | --- |
| Only `src/storage` imports Dexie | Storage engine stays replaceable; schema knowledge stays in one place |
| Only `src/ai/providers` knows a provider's wire format | Adding a provider cannot ripple into the UI |
| `shared/` never imports `features/` | Prevents cycles; keeps `shared` genuinely shared |
| UI never calls a provider directly | The key lives in the worker's flow; the UI stays testable without network |
| Content script never imports `ai/` or the key | It runs in untrusted pages |

---

## Extension architecture

Three MV3 constraints shaped the code more than any preference:

**1. Content scripts cannot be ES modules.** Chrome injects them as classic scripts. The default Vite
build emitted `import` statements, which failed silently — highlighting simply never ran, with no
console error. The content script is therefore built by a second config,
`vite.content.config.ts`, into one self-contained IIFE. See
[ADR-006](DECISION_LOG.md#adr-006--the-content-script-is-built-separately-as-an-iife).

**2. The service worker is evicted when idle.** It cannot hold in-memory state between events. All
state lives in IndexedDB or `chrome.storage.local`, and every handler reads what it needs. A
consequence discovered in testing: relying on the worker to relay setting changes to pages fails when
the worker is asleep, so content scripts subscribe to `chrome.storage.onChanged` directly. See
[ADR-007](DECISION_LOG.md#adr-007--the-content-script-observes-storage-directly).

**3. Surfaces share no memory.** All cross-surface communication is message passing over a typed
contract, `src/shared/messaging/contract.ts`. See [API guidelines](API_GUIDELINES.md).

**Permissions** are requested in `scripts/manifest.ts` and justified individually in
[Security](SECURITY.md).

---

## Storage architecture

Two stores, chosen for different access patterns:

| Store | Holds | Why |
| --- | --- | --- |
| IndexedDB via Dexie | Vocabulary entries | Structured, indexed, queryable, no practical size limit |
| `chrome.storage.local` | Settings (`avs:settings`) | Readable from every surface including the worker, with a change event content scripts can subscribe to |

Settings deliberately do **not** live in IndexedDB: content scripts need them cheaply on every page
load and need change notifications, which `chrome.storage` provides and IndexedDB does not.

`VocabularyRepository` is the only code that touches Dexie. Entries carry a normalised `wordKey`
(lowercased, whitespace-collapsed) with a unique index, which turns "save the same word twice" into
an update rather than a duplicate. Full schema in [Storage](STORAGE.md).

---

## AI provider abstraction

Every provider implements one interface:

```ts
interface AiProvider {
  id: AiProviderId;
  explain(request: ExplainRequest): Promise<Explanation>;
  /** Generic chat completion for custom prompts (e.g. Vocabulary Goal Mode). */
  complete(system: string, user: string, config: ProviderConfig): Promise<string>;
}
```

OpenAI, OpenRouter, Ollama and LM Studio all speak the chat-completions dialect, so they share a
single `OpenAiCompatibleProvider` parameterised by a preset (base URL, default model, whether a key is
required). Gemini and Anthropic have their own adapters because their wire formats genuinely differ.
Adding a compatible provider is a data change, not a code change.

Two properties make this hold up in practice:

- **Errors are normalised.** Every failure becomes an `AiError` with a stable code, so no UI branches
  per provider.
- **Parsing is tolerant.** Models return prose preambles, fenced blocks and inconsistent field types
  even under a strict prompt. `parse.ts` coerces rather than rejects, failing only when there is no
  usable meaning.

Details and a step-by-step guide in [AI providers](AI_PROVIDER.md).

---

## Communication flow

All inter-surface calls go through one typed contract. Message types and their response shapes are
declared together, so a handler cannot return the wrong type:

| Message | Direction | Response |
| --- | --- | --- |
| `save-entry` | UI → worker | `VocabularyEntry` |
| `get-selection` | worker → content | `SelectionPayload \| null` |
| `save-current-selection` | UI → worker | `VocabularyEntry \| null` |
| `explain` | UI → worker | `Explanation` |
| `get-highlight-data` | content → worker | `HighlightData` |
| `vocabulary-changed` | broadcast | `void` |
| `settings-changed` | broadcast | `void` |
| `show-toast` | worker → content | `void` |
| `radar:scan` | popup → worker → content | `AnalyzePageResult` (ranked candidates, chunk progress, partial flag) — worker forwards to the page's own `radar:scan` handler, which extracts text locally |
| `radar:analyze` | content → worker | `AnalyzePageResult` (goal text carried in the payload, so the worker never re-reads the page tab) |

`dispatch()` in `src/shared/messaging/router.ts` is **total**: success, thrown errors, unknown message
types and malformed payloads all become a `MessageResult`, never an unhandled rejection. Handlers are
pure functions over injected dependencies, which is why they unit-test without a browser.

---

## Error handling

| Layer | Strategy |
| --- | --- |
| Provider HTTP | Normalised into `AiError` with a stable code and a human-readable message |
| Response parsing | Tolerant coercion; only a missing meaning is fatal |
| Message routing | Every outcome becomes `{ ok: true, data }` or `{ ok: false, error, code }` |
| Repositories | Throw on genuine failure; callers translate to user-facing text |
| UI | Errors render inline next to the action that caused them; a failed optimistic update reloads from storage |
| Content script | Defensive: a page that breaks the walker must not break the page |

The principle: **fail visibly and specifically**. A user who sees `unauthorized` knows to check their
key; a user who sees "something went wrong" files a bug.

---

## Future extension points

Places designed to be extended, and how:

| Extension point | How to extend | Cost |
| --- | --- | --- |
| New OpenAI-compatible provider | Add a preset to `OPENAI_COMPATIBLE_PRESETS` and its id to `AI_PROVIDER_IDS` | Data change only |
| Provider with a different wire format | New adapter in `src/ai/providers/`, register in `registry.ts` | One file plus tests |
| New message type | Extend `Message` and `ResponseMap`, add a handler | Type system flags every gap |
| Schema change | Add a Dexie version with an upgrade function; see [Storage](STORAGE.md) | Migration required |
| New surface (e.g. a side panel) | New HTML entry plus a Vite input; reuse hooks and repositories | Additive |
| Streaming responses | Extend `AiProvider` with an optional streaming method; adapters opt in | Interface change, currently unimplemented |
| Firefox port | Manifest differences and a separate E2E matrix | Deferred; see [Roadmap](ROADMAP.md) |

Deliberately **not** designed for: multi-user data, server sync, or a plugin system for third-party
code. Each conflicts with the local-first, no-backend premise in
[Project overview](PROJECT_OVERVIEW.md#non-goals).
