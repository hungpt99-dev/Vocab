# Folder Structure

Every directory: what it is for, who owns it, what it may depend on, and what must never be placed
there. Related: [Architecture](ARCHITECTURE.md), [Coding standards](CODING_STANDARDS.md).

---

## Dependency direction

Dependencies point one way. A violation is a review blocker, not a style preference.

```
   popup/  options/  features/          presentation
            │
            ├──► shared/hooks ──► shared/messaging
            │                └──► storage/
            │
   background/ ──► ai/ ──► ai/providers/  application → infrastructure
            └──► storage/
                     │
                     ▼
              Dexie · chrome.storage · HTTPS
```

Three rules carry most of the weight:

| Rule | Why |
| --- | --- |
| Only `src/storage` imports Dexie | Keeps the storage engine replaceable and schema knowledge in one place |
| Only `src/ai/providers` knows a provider's wire format | Adding a provider cannot ripple into the UI |
| `src/shared` never imports from `src/features` | Prevents cycles and keeps `shared` genuinely shared |

---

## The four MV3 surfaces

Manifest V3 splits an extension into isolated contexts that share **no memory**. They communicate only
through the typed message contract and shared storage.

| Surface | Entry | Lifetime | Can it touch the DOM? | Holds the API key? |
| --- | --- | --- | --- | --- |
| Service worker | `src/background/index.ts` | Event-driven, evicted when idle | No | Yes, transiently |
| Content script | `src/content/index.ts` | Per page, from `document_idle` | Yes, the host page | **Never** |
| Popup | `src/popup/` | While open | Own document | Reads for settings UI |
| Options | `src/options/` | While open | Own document | Reads and writes |

The content script is excluded from the key because it runs inside untrusted third-party pages.

---

## Annotated tree

```
ai-vocab-saver/
├── .github/                 CI workflows, PR and issue templates, Dependabot
├── .vscode/                 Shared editor settings and recommended extensions
├── docs/                    All documentation (this directory)
├── e2e/                     Playwright specs and fixtures
├── scripts/                 Build-time tooling (manifest generation)
├── src/
│   ├── ai/                  Provider-agnostic AI layer
│   │   └── providers/       One adapter per wire format
│   ├── background/          MV3 service worker
│   ├── content/             Script injected into every page
│   ├── features/            Feature-scoped UI
│   │   ├── capture/
│   │   ├── library/
│   │   └── settings/
│   ├── options/             Options page React root
│   ├── popup/               Popup React root
│   ├── shared/              Cross-cutting, feature-agnostic code
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── messaging/
│   │   ├── styles/
│   │   ├── types/
│   │   └── ui/
│   ├── storage/             Persistence boundary
│   └── test/                Vitest setup and the Chrome mock
├── tailwind.config.ts       Imports design tokens
├── vite.config.ts           Popup, options, background (ESM)
└── vite.content.config.ts   Content script (IIFE) — see ADR-006
```

---

## Directory reference

### `src/ai/`

**Purpose.** Turn a word plus context into a structured `Explanation`, independently of which provider
is configured.

**Contains.** `types.ts` (the `AiProvider` interface, `AiError`), `registry.ts`, `explain-service.ts`,
`prompt.ts`, `parse.ts`, `http.ts`, and `providers/`.

**May depend on.** `shared/types`, `shared/lib`, `storage` (for settings).

**Never place here.** React components, DOM manipulation, Chrome API calls, or any UI text formatting.
Provider-specific parsing belongs in `providers/`, not in `parse.ts`.

See [AI providers](AI_PROVIDER.md).

### `src/ai/providers/`

**Purpose.** The only place a provider's wire format is known.

**May depend on.** `../types`, `../http`, `../parse`.

**Never place here.** Business logic, caching, or anything the UI would need to import. Use
`postJson()` rather than calling `fetch` directly, or you lose timeout, abort and error normalisation.

### `src/background/`

**Purpose.** The service worker: context menu, keyboard command, message routing, AI orchestration and
broadcasts.

**Contains.** `index.ts` (Chrome event wiring only) and `handlers.ts` (pure, dependency-injected
functions).

**May depend on.** `ai`, `storage`, `shared/*`.

**Never place here.** React, DOM access (there is no document), or long-lived in-memory state — the
worker is evicted when idle.

**Owner rule.** Keep `index.ts` thin. Logic goes in `handlers.ts` so it can be unit-tested without a
browser.

### `src/content/`

**Purpose.** Everything that happens inside a third-party page: reading the selection, highlighting,
the hover card, toasts, the explain popover.

**Contains.** `index.ts`, `matcher.ts`, `highlighter.ts`, `hover-card.ts`, `selection.ts`,
`styles.ts`, `toast.ts`, `toolbar.ts`, `explain-popover.ts`.

**May depend on.** `shared/lib`, `shared/messaging`, `shared/types`, `shared/styles/tokens`.

**Never place here.** The API key, provider calls, Dexie, React, or anything importing `src/ai`. This
code runs in a hostile environment and is built as a separate IIFE bundle.

**Constraint.** No ESM at runtime — see
[ADR-006](DECISION_LOG.md#adr-006--the-content-script-is-built-separately-as-an-iife).

### `src/features/`

**Purpose.** UI grouped by the feature it serves, so a change stays in one folder.

| Folder | Owns |
| --- | --- |
| `capture/` | `SaveForm` — the popup's save UI |
| `library/` | `LibraryList`, `LibraryToolbar`, `EntryCard`, `ExplanationView` |
| `settings/` | `ProviderSettings`, `AppearanceSettings`, `DataSettings`, `backup.ts` |

**May depend on.** `shared/*`, `storage`, `ai` types.

**Never place here.** Code used by two or more features (promote it to `shared/`), or generic UI
primitives.

**Promotion rule.** Move to `shared/` on the **second** consumer, not in anticipation of one.

### `src/shared/`

**Purpose.** Code used by more than one feature or surface.

| Folder | Contains | Notes |
| --- | --- | --- |
| `hooks/` | `useVocabulary`, `useSettings`, `useDebouncedValue` | Data access for components lives here |
| `lib/` | `text`, `id`, `result` | Pure functions only; no side effects |
| `messaging/` | `contract`, `router`, `client` | The internal API; see [API guidelines](API_GUIDELINES.md) |
| `styles/` | `tokens.ts`, `tailwind.css` | Single source of design values |
| `types/` | `vocabulary`, `settings` | Domain models |
| `ui/` | `Button`, `IconButton`, `TextField`, `Select`, `TagInput`, `Spinner`, `EmptyState` | Presentational primitives |

**May depend on.** Other `shared/` modules and platform APIs.

**Never place here.** Anything importing from `src/features` (hard rule), feature-specific logic, or
business rules inside `ui/` — primitives stay presentational.

### `src/storage/`

**Purpose.** The persistence boundary. The **only** place Dexie is imported.

**Contains.** `database.ts` (schema), `vocabulary-repository.ts`, `settings-repository.ts`.

**May depend on.** `shared/types`, Dexie, `chrome.storage`.

**Never place here.** UI, AI logic, or Chrome messaging. Repositories expose domain types, never Dexie
tables.

See [Storage](STORAGE.md).

### `src/popup/` and `src/options/`

**Purpose.** React roots and HTML entry points for the two extension pages. Thin by design — they
compose feature components and own no logic.

**Never place here.** Business logic or reusable components.

### `src/test/`

**Purpose.** Test infrastructure: `setup.ts` and `chrome-mock.ts`.

**Never place here.** Actual tests — those are co-located with the code they cover.

### `e2e/`

**Purpose.** Playwright specs and the fixtures that load the built extension.

**Never place here.** Logic tests that could run as unit tests; E2E is slow and should be spent on
Chrome-boundary behaviour.

### `scripts/`

**Purpose.** Build-time tooling: `manifest.ts` generates the MV3 manifest from `package.json`;
`crx-manifest-plugin.ts` emits it during the build.

**Never place here.** Runtime code — nothing here ships in the extension.

---

## Adding a new file

Ask, in order:

1. **Is it used by one feature?** → that feature folder.
2. **By two or more?** → the matching `shared/` subfolder.
3. **Does it touch persistence?** → `storage/`, behind a repository.
4. **Does it know a provider's wire format?** → `ai/providers/`.
5. **Does it run inside a web page?** → `content/`, and check the constraints above.
6. **None of these?** Reconsider — it may not belong in the codebase yet.
