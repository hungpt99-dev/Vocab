# Architecture Decision Records

Short records of choices that were not obvious, and what they cost.

---

## ADR-001 — Local-first with no backend

**Decision.** Store everything in the browser: vocabulary in IndexedDB (Dexie), settings in
`chrome.storage.local`. Users supply their own AI API key.

**Why.** The product is a personal vocabulary notebook. A backend would add accounts, hosting,
a privacy policy and an attack surface, in exchange for sync the user did not ask for.

**Consequences.** Zero operating cost and no telemetry, but no cross-device sync — mitigated by JSON
export/import. The API key lives in browser storage, which any extension-level compromise could read;
this is the standard trade-off for BYO-key extensions and is stated plainly in the README.

---

## ADR-002 — Dexie behind a repository, not used directly

**Decision.** All Dexie access is confined to `VocabularyRepository`; the UI sees only domain types.

**Why.** Directly querying Dexie from components would scatter schema knowledge across the codebase
and make the storage engine impossible to change.

**Consequences.** One extra layer, but the whole persistence surface is unit-testable against
`fake-indexeddb`, and filtering/sorting logic lives in one place.

---

## ADR-003 — A single adapter for OpenAI-compatible providers

**Decision.** OpenAI, OpenRouter, LM Studio and Ollama share one `OpenAiCompatibleProvider`
parameterised by a preset (base URL, default model, whether a key is required). Gemini and Anthropic
get dedicated adapters.

**Why.** Those four speak an identical chat-completions dialect. Four near-identical classes would be
pure duplication; adding a fifth compatible provider should be a data change, not a code change.

**Consequences.** Adding an OpenAI-compatible provider means appending one preset object. Genuinely
different APIs still need a real adapter, which is correct.

---

## ADR-004 — Errors normalised into `AiError`

**Decision.** Every provider failure becomes an `AiError` with a stable code
(`missing_api_key`, `unauthorized`, `rate_limited`, `timeout`, `aborted`, `bad_response`, …).

**Why.** Otherwise every UI surface would need to interpret six different error shapes.

**Consequences.** Provider-specific detail is preserved in the message but flattened for control flow.

---

## ADR-005 — Tolerant parsing of AI responses

**Decision.** `toExplanation()` strips markdown fences, locates the outermost JSON object, coerces
scalars into arrays, drops non-string members, and falls back `simpleExplanation → meaning`. It fails
only when there is no usable meaning.

**Why.** LLMs return prose preambles, fenced blocks and inconsistent field types even under a strict
prompt. Being strict here would make the feature feel broken.

**Consequences.** Slightly permissive: a malformed field is silently dropped rather than surfaced.
Preferred over showing the user a parse error for an otherwise good answer.

---

## ADR-006 — The content script is built separately as an IIFE

**Decision.** `vite.content.config.ts` builds `src/content/index.ts` into a single self-executing
bundle, separate from the main multi-entry build.

**Why.** Chrome injects content scripts as classic scripts. The default Vite build emitted
`import { … } from './assets/…'`, which fails at runtime with no useful error. This was caught by
inspecting build output, not by tests.

**Consequences.** Two build commands and a slightly larger content bundle (no shared chunks). Worth it
for a script that actually runs.

---

## ADR-007 — The content script observes storage directly

**Decision.** Rather than relying only on a `settings-changed` broadcast from the service worker, the
content script subscribes to `chrome.storage.onChanged` itself.

**Why.** An MV3 service worker is evicted after ~30s idle. Changing the highlight colour while no
worker is alive left open pages stale. Caught by an E2E test, not a unit test.

**Consequences.** Two paths can trigger a refresh; `refresh()` is idempotent, so this is harmless.

---

## ADR-008 — One compiled regex for matching

**Decision.** `VocabularyMatcher` compiles all saved words into a single Unicode word-boundary regex,
alternatives sorted longest-first.

**Why.** Scanning every text node once per saved word is O(nodes × words). One pass keeps highlighting
usable with a large vocabulary, and longest-first ordering makes `piece of cake` win over `cake`.

**Consequences.** The regex is rebuilt whenever vocabulary changes — cheap and infrequent. Lookarounds
(`\p{L}\p{N}`) require a modern engine, which the manifest's `minimum_chrome_version: 110` guarantees.

---

## ADR-009 — Optimistic UI with reload-on-failure

**Decision.** Mutations update React state first, then persist; on failure the hook reloads from
storage to discard the optimistic value.

**Why.** IndexedDB round-trips made favourite toggles and checkboxes visibly lag, and controlled
checkboxes actively reverted mid-interaction (caught by E2E).

**Consequences.** A failed write flashes the wrong value briefly before correcting. Acceptable for a
local database where writes essentially always succeed.

---

## ADR-010 — E2E fixtures served over HTTP

**Decision.** Playwright serves its fixture page from a throwaway `node:http` server instead of using
a `data:` URL.

**Why.** Content scripts matching `<all_urls>` are not injected into `data:` URLs, so the first
highlighting test failed with zero highlights while the feature worked fine in a real browser.

**Consequences.** A few lines of fixture setup, and tests that exercise the same code path as reality.

---

## ADR-011 — `no-undef` disabled for TypeScript

**Decision.** The core ESLint `no-undef` rule is off for `.ts`/`.tsx`.

**Why.** It cannot see ambient declarations such as `chrome`, and produced 149 false positives. TypeScript
already performs strictly better undefined-symbol analysis.

**Consequences.** None for TypeScript files; this is the configuration `typescript-eslint` recommends.
