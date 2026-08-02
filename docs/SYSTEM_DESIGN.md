# System Design

Runtime mechanics: sequencing, algorithms, lifecycle and failure behaviour. For the static shape of
the system see [Architecture](ARCHITECTURE.md); for why choices were made see the
[Decision log](DECISION_LOG.md).

---

## 1. Service worker lifecycle

An MV3 service worker is not a long-running process. Chrome starts it on an event and evicts it after
roughly 30 seconds of inactivity. Three consequences drive the design:

| Consequence | Response in this codebase |
| --- | --- |
| No in-memory state survives between events | Every handler reads from IndexedDB or `chrome.storage.local`. Nothing is cached in module scope across events. |
| Listeners must be registered synchronously at top level | `registerMessageHandlers()`, `onInstalled`, `onClicked` and `onCommand` are all wired at import time in `src/background/index.ts`. Registering inside an async callback would miss events on a cold start. |
| The worker may be asleep when something happens elsewhere | Content scripts subscribe to `chrome.storage.onChanged` directly instead of waiting for a broadcast. See [ADR-007](DECISION_LOG.md#adr-007--the-content-script-observes-storage-directly). |

The context menu is created in `onInstalled` and preceded by `removeAll()`, because re-running
`create()` with an existing id throws.

---

## 2. Capture sequence

Both the context menu and the keyboard shortcut converge on `handleCapture()`.

```
 user            content script         service worker          IndexedDB
  │                    │                       │                    │
  │ select text        │                       │                    │
  │───────────────────►│                       │                    │
  │ right-click / ⌘⇧S  │                       │                    │
  │───────────────────────────────────────────►│                    │
  │                    │  get-selection        │                    │
  │                    │◄──────────────────────│                    │
  │                    │  word, sentence,      │                    │
  │                    │  sourceUrl, title     │                    │
  │                    │──────────────────────►│                    │
  │                    │                       │ saveSelection()    │
  │                    │                       │───────────────────►│
  │                    │                       │  upsert on wordKey │
  │                    │  show-toast           │◄───────────────────│
  │                    │◄──────────────────────│                    │
  │  toast appears     │                       │ broadcast          │
  │◄───────────────────│                       │ vocabulary-changed │
```

**Why the worker asks the page for context.** `info.selectionText` from the context menu gives the
selected words but not the sentence around them, and the keyboard command gives nothing at all. One
round trip to the content script yields sentence, URL and title uniformly for both routes.

**Fallback order.** `handleCapture()` prefers explicit `selectionText` (context menu), falls back to
what the page reports, and aborts with a toast if both are empty. URL and title fall back the other
way — page-reported first, event-supplied second — because the page value is always current.

**Failure.** Any throw becomes an error toast on the originating tab. Nothing is written partially:
the entry is one `save()` call.

---

## 3. Matching algorithm

`VocabularyMatcher` compiles the entire vocabulary into **one** regular expression:

```ts
new RegExp(
  `(?<![\\p{L}\\p{N}])(${keys.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
)
```

Four decisions are encoded in that line:

| Element | Purpose |
| --- | --- |
| Single alternation | Scanning is one pass per text node, not one pass per saved word. With *n* nodes and *m* words this is O(n) rather than O(n·m). |
| Keys sorted longest-first | Regex alternation is first-match-wins, so `piece of cake` must precede `cake` or the phrase would never match. |
| Unicode property lookarounds | `\b` is ASCII-oriented and mis-handles accented text. `(?<![\p{L}\p{N}])` treats `café` and `naïve` correctly. |
| `escapeRegExp` on every key | A saved word may contain regex metacharacters. Without escaping, saving `C++` would corrupt the pattern. |

Lookarounds rather than `\b` also give correct behaviour at phrase edges, where `\b` would test only
the first and last character of the whole alternation.

Matches are mapped back to entries through a `Map` keyed by the normalised word key, applying the same
normalisation used at write time (`toLowerCase()` and whitespace collapsing). Normalising identically
on both sides is what makes `Serendipity`, `serendipity` and `serendipity ` one entry.

An empty vocabulary produces a `null` pattern and `findAll()` returns immediately, so users with no
saved words pay nothing.

---

## 4. DOM highlighting

Scanning third-party pages safely is the most defensive code in the project.

**Collect, then mutate.** The walker gathers candidate text nodes into an array *before* wrapping
anything. Mutating during a live `TreeWalker` traversal invalidates it and causes skipped or repeated
nodes.

**Skip list.** These are never entered:

| Skipped | Why |
| --- | --- |
| `<script>`, `<style>`, `<noscript>` | Rewriting them changes behaviour, not presentation |
| `<textarea>`, `<input>`, `contenteditable` | Would corrupt user input |
| `<code>`, `<pre>` | Highlighting inside code samples is noise |
| Existing `mark.avs-highlight` | Makes repeat scans idempotent |
| The extension's own overlays (`.avs-card`, `.avs-toast`) | Prevents self-highlighting |

**Right-to-left replacement.** Matches within a node are applied from the last to the first, so
earlier offsets stay valid as the node is split.

**Dynamic pages.** A `MutationObserver` batches additions and processes them on
`requestIdleCallback`, so a live feed cannot starve the main thread. Idempotence makes repeated
processing of the same subtree harmless.

**Idempotence is the key property.** The observer, a settings change and the initial load can all
trigger a scan of overlapping regions. Because highlights are skipped rather than re-wrapped, none of
these interleavings produce nested `<mark>` elements.

---

## 5. Hover card

One card element is reused for every highlight rather than one per highlight — with hundreds of
matches on a page, per-highlight nodes would be wasteful.

- Opens on `mouseenter` **and** `focusin`, so keyboard users get the same information.
- Position is clamped to the viewport so cards near an edge stay fully visible.
- `z-index` is `2147483647` — the maximum signed 32-bit value — because the card must sit above
  arbitrary host-page stacking contexts.
- `pointer-events: none` prevents the card from stealing the hover that keeps it open.
- Closes on `mouseleave`, `focusout` and `Escape`; `role="tooltip"` with `aria-describedby` links it
  to the highlight for screen readers.

---

## 6. AI request pipeline

```
ExplainService.explain(word, context)
  → settingsRepository.get()                    // provider, key, model, baseUrl
  → registry.getProvider(settings.provider)
  → guard: key required but absent → AiError('missing_api_key')   // no network call
  → buildPrompt(word, context)
  → provider.explain() → postJson()
        ├── AbortController with a 30 s timeout
        ├── caller's AbortSignal chained in
        ├── non-2xx → statusToCode() → AiError
        └── network/parse failure → normalizeError() → AiError
  → parse.toExplanation()                       // tolerant coercion
  → cached onto the entry in IndexedDB
```

**Timeout and abort.** `postJson()` owns a single `AbortController`. A 30-second timer aborts with
`AiError('timeout')`; the caller's signal chains in and aborts with `AiError('aborted')`. Both the
timer and the listener are released in `finally`, so no leak occurs on either path.

**Status mapping** is deliberately coarse and stable:

| HTTP status | Code |
| --- | --- |
| 401, 403 | `unauthorized` |
| 429 | `rate_limited` |
| ≥ 500 | `server_error` |
| other non-2xx | `network` |

The response body's first 300 characters are appended to the message — enough for a provider's error
detail, bounded so a HTML error page cannot flood the UI.

**No retries today.** A failed request surfaces immediately. Automatic retry is deliberate future work
rather than an oversight: retrying an unauthorized or malformed request wastes the user's quota, so
only `rate_limited`, `server_error` and `network` should ever be retried, with backoff. Tracked in
[Known limitations](KNOWN_LIMITATIONS.md).

**Tolerant parsing** is described in [AI providers](AI_PROVIDER.md#response-parsing); the design point
is that the failure mode of a strict parser here is a broken feature, while the failure mode of a
tolerant one is a dropped field.

---

## 7. State synchronisation

Four surfaces must agree without shared memory. Two mechanisms cover it:

| Change | Mechanism | Reaches |
| --- | --- | --- |
| Vocabulary changed | `broadcast('vocabulary-changed')` from the worker | Open popup, all content scripts |
| Settings changed | `chrome.storage.onChanged` observed directly | All content scripts, regardless of worker state |

Settings use storage observation rather than a broadcast because the worker may be evicted at the
moment the user changes a preference — the failure this design fixes was real and caught by an E2E
test. `refresh()` in the content script is idempotent, so a change that arrives by both paths is
harmless.

**Optimistic UI.** Hooks apply a mutation to React state first, then persist. On failure they reload
from storage, discarding the optimistic value. Without this, controlled inputs visibly reverted
mid-interaction while the IndexedDB round trip was in flight. See
[ADR-009](DECISION_LOG.md#adr-009--optimistic-ui-with-reload-on-failure).

---

## 8. Build pipeline

Two Vite configs, because the outputs have incompatible requirements:

| Config | Entries | Format | Why |
| --- | --- | --- | --- |
| `vite.config.ts` | popup, options, background | ES modules, code-split | Extension pages and a `type: module` worker support ESM and benefit from shared chunks |
| `vite.content.config.ts` | content script | Single IIFE | Chrome injects content scripts as classic scripts; ESM fails silently |

`npm run build` runs both. `scripts/crx-manifest-plugin.ts` emits `dist/manifest.json` from
`scripts/manifest.ts`, so the manifest version always tracks `package.json`.

The IIFE bundle cannot share chunks with the main build, making the content script slightly larger.
That is the accepted cost of a script that actually executes.

---

## 9. Failure modes

| Failure | Behaviour | Recovery |
| --- | --- | --- |
| Worker evicted mid-flow | Chrome restarts it on the next event | Automatic; no state was held |
| Content script cannot inject (`chrome://`, Web Store, PDF) | Capture and highlighting unavailable on that page | Expected; documented in [Known limitations](KNOWN_LIMITATIONS.md) |
| IndexedDB unavailable or full | Repository throws; UI surfaces the error | User frees space; `unlimitedStorage` is requested to make this rare |
| Provider unreachable | `AiError('network')` naming the base URL | User checks connectivity or that their local model is running |
| Malformed AI response | `AiError('bad_response')`; entry unchanged | User retries or switches model |
| Corrupt import file | Rejected before any write | Nothing changed; user re-exports |
| Host page defines conflicting CSS | Overlays use maximum `z-index` and scoped `avs-` class names | — |

The invariant across all of these: **a failure never leaves data half-written**, because every write
is a single repository call.
