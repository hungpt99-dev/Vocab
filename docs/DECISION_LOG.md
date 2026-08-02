# Decision Log

Architecture Decision Records. Each entry states the problem, the options weighed, what was chosen,
why, what it costs, and what would cause a revisit.

A decision belongs here when it constrains future work, when a reasonable engineer would choose
differently, or when it was forced by a non-obvious platform behaviour. Routine choices do not.

| ADR | Decision | Status |
| --- | --- | --- |
| [001](#adr-001--local-first-with-no-backend) | Local-first with no backend | Accepted |
| [002](#adr-002--dexie-behind-a-repository) | Dexie behind a repository | Accepted |
| [003](#adr-003--one-adapter-for-openai-compatible-providers) | One adapter for OpenAI-compatible providers | Accepted |
| [004](#adr-004--normalise-all-provider-errors-into-aierror) | Normalise all provider errors into `AiError` | Accepted |
| [005](#adr-005--tolerant-parsing-of-ai-responses) | Tolerant parsing of AI responses | Accepted |
| [006](#adr-006--the-content-script-is-built-separately-as-an-iife) | Content script built separately as an IIFE | Accepted |
| [007](#adr-007--the-content-script-observes-storage-directly) | Content script observes storage directly | Accepted |
| [008](#adr-008--one-compiled-regex-for-matching) | One compiled regex for matching | Accepted |
| [009](#adr-009--optimistic-ui-with-reload-on-failure) | Optimistic UI with reload on failure | Accepted |
| [010](#adr-010--e2e-fixtures-served-over-http) | E2E fixtures served over HTTP | Accepted |
| [011](#adr-011--no-undef-disabled-for-typescript) | `no-undef` disabled for TypeScript | Accepted |
| [012](#adr-012--a-single-design-token-module-for-two-styling-paths) | A single design token module for two styling paths | Accepted |
| [013](#adr-013--settings-in-chromestoragelocal-not-indexeddb) | Settings in `chrome.storage.local`, not IndexedDB | Accepted |
| [014](#adr-014--retry-and-rate-limit-only-transient-ai-failures) | Retry and rate-limit only transient AI failures | Accepted |

---

## ADR-001 — Local-first with no backend

**Problem.** The product needs to store a user's vocabulary and call an AI model. The default industry
answer is a backend with accounts and a server-held API key.

**Options considered.**

| Option | Assessment |
| --- | --- |
| Hosted backend with accounts and a project API key | Best onboarding, but requires hosting, billing, auth, a privacy policy, and makes the project liable for users' AI usage. |
| Backend for sync only; user's key stays local | Removes billing liability but keeps accounts, hosting and conflict resolution. |
| **No backend; everything local; user supplies the key** | **Chosen.** |

**Chosen.** Vocabulary in IndexedDB, settings in `chrome.storage.local`, user-supplied API key, no
server of any kind.

**Reason.** The product is a personal notebook. A backend would add an operating cost, an outage
surface, a data-breach surface and a privacy policy, in exchange for sync the user did not ask for.
Bring-your-own-key also aligns incentives: costs are visible to and controlled by the user.

**Trade-offs.** No cross-device sync. The API key sits in browser storage, readable by anyone with
local profile access. Onboarding requires the user to obtain a key. Mitigations: documented JSON
export/import, explicit disclosure in [Security](SECURITY.md), and local providers (Ollama, LM Studio)
that need no key at all.

**Future considerations.** Optional end-to-end-encrypted sync could be added without breaking the
premise, but only if users actually ask for it. A project-supplied key remains permanently out of
scope.

---

## ADR-002 — Dexie behind a repository

**Problem.** Where should IndexedDB access live?

**Options considered.** Query Dexie directly from components (fewer layers, faster to write);
a repository class; a generic data-access abstraction over multiple engines (speculative).

**Chosen.** A repository class per store. `src/storage` is the only place Dexie is imported.

**Reason.** Direct access would scatter schema knowledge across every component and make queries
untestable without a full render. The repository speaks domain types, so the UI never sees a Dexie
table.

**Trade-offs.** One extra layer, and a small temptation to add pass-through methods. In exchange the
entire persistence surface is unit-tested against `fake-indexeddb`, and filtering and sorting live in
one place.

**Future considerations.** Swapping IndexedDB, or adding a cache in front of it, is a change to one
folder. See [Storage](STORAGE.md).

---

## ADR-003 — One adapter for OpenAI-compatible providers

**Problem.** Six providers must be supported. Four of them speak an identical dialect.

**Options considered.**

| Option | Assessment |
| --- | --- |
| One class per provider | Symmetrical, but four near-identical files; a fix must be applied four times. |
| One generic client configured entirely by the user | Maximum flexibility, unacceptable setup burden. |
| **Shared adapter for the compatible dialect, bespoke adapters where the wire format differs** | **Chosen.** |

**Chosen.** `OpenAiCompatibleProvider` parameterised by a preset serves OpenAI, OpenRouter, Ollama and
LM Studio. Gemini and Anthropic have dedicated adapters.

**Reason.** Duplication is the main long-term cost in a provider layer. Adding a fifth compatible
provider should be a data change, not a code change — and it is: one preset object.

**Trade-offs.** The preset indirection is slightly less obvious than a class per provider. Providers
that merely resemble the dialect could tempt an over-fit preset; the rule is that a genuinely
different wire format gets its own adapter.

**Future considerations.** If presets accumulate provider-specific conditionals, that is the signal to
split. See [AI providers](AI_PROVIDER.md).

---

## ADR-004 — Normalise all provider errors into `AiError`

**Problem.** Six providers report failures in six shapes; the UI needs one.

**Chosen.** Every failure becomes an `AiError` carrying a stable code (`missing_api_key`,
`unauthorized`, `rate_limited`, `server_error`, `network`, `timeout`, `aborted`, `bad_response`) plus a
human-readable message and, where relevant, the HTTP status.

**Reason.** Without this, every UI surface would branch per provider — the exact coupling the
abstraction exists to prevent. Stable codes also make error paths testable.

**Trade-offs.** Provider-specific nuance is flattened. Mitigated by preserving the provider's own
message text (bounded to 300 characters so an HTML error page cannot flood the UI).

**Future considerations.** Codes are effectively public API for the UI; add rather than rename.

---

## ADR-005 — Tolerant parsing of AI responses

**Problem.** Models return prose preambles, fenced code blocks, and inconsistent field types even when
the prompt demands strict JSON.

**Options considered.** Strict `JSON.parse` and fail; tolerant coercion; a second AI call to repair
malformed output (slow, costs the user money, can also fail).

**Chosen.** `toExplanation()` strips fences, extracts the outermost JSON object, coerces scalars into
arrays, drops non-string members, and falls back `simpleExplanation → meaning`. It fails only when no
usable meaning is present.

**Reason.** The failure mode of strictness here is a feature that looks broken through no fault of the
user. The failure mode of tolerance is a dropped field.

**Trade-offs.** A malformed field is silently dropped rather than surfaced, which can mask a bad
prompt. Accepted: the alternative is showing a parse error for an otherwise good answer.

**Future considerations.** Providers with native structured-output modes could use a strict path,
keeping tolerant parsing as the fallback.

---

## ADR-006 — The content script is built separately as an IIFE

**Problem.** After the first build, highlighting never ran. There was no console error and no test
failure — unit tests exercised the modules directly, so they passed.

**Root cause.** Vite emitted the content script as an ES module with `import` statements. Chrome
injects content scripts as **classic scripts**, where module syntax fails silently.

**Options considered.** Inline everything into one file manually (unmaintainable); mark the script as
a module in the manifest (not supported by MV3 content scripts); a second Vite config producing an
IIFE.

**Chosen.** `vite.content.config.ts` builds `src/content/index.ts` into one self-contained IIFE;
`npm run build` runs both configs.

**Reason.** It is the only option that keeps the source modular while satisfying the platform.

**Trade-offs.** Two build steps, and the content bundle cannot share chunks with the main build, so it
is slightly larger. Worth it for a script that executes.

**Future considerations.** A build assertion that `dist/content.js` contains no top-level `import`
would catch a regression earlier than E2E does.

---

## ADR-007 — The content script observes storage directly

**Problem.** Changing the highlight colour or disabling highlighting did not affect already-open tabs.
Caught by an E2E test, not by unit tests.

**Root cause.** The worker broadcast `settings-changed`, but an MV3 worker is evicted after ~30
seconds idle. If the user changed a setting while it was asleep, nothing sent the broadcast.

**Options considered.** Keep the worker alive with a heartbeat (wasteful, fights the platform, has
been discouraged by Chrome); poll settings from each content script (wasteful); subscribe to
`chrome.storage.onChanged` in the content script.

**Chosen.** Content scripts observe `chrome.storage.onChanged` for the settings key directly. The
broadcast remains for other flows.

**Reason.** `chrome.storage` events are delivered by the browser regardless of worker state, which
removes the dependency on a component that is designed to disappear.

**Trade-offs.** Two paths can now trigger a refresh. `refresh()` is idempotent, so this is harmless.

**Future considerations.** Any future cross-surface state should default to observing storage rather
than relying on the worker to relay.

---

## ADR-008 — One compiled regex for matching

**Problem.** Every text node on every page must be checked against every saved word.

**Options considered.** Loop words × nodes with `indexOf` (O(n·m), degrades as vocabulary grows);
a trie (better asymptotics, significant complexity, needs its own boundary handling); one compiled
alternation regex.

**Chosen.** A single Unicode-aware regex with alternatives sorted longest-first.

**Reason.** One pass per text node regardless of vocabulary size, with correctness properties handled
by the engine. Longest-first ordering makes `piece of cake` win over `cake`; Unicode property
lookarounds `(?<![\p{L}\p{N}])` handle accented text where `\b` fails; every key is escaped so a
saved word containing regex metacharacters cannot corrupt the pattern.

**Trade-offs.** The pattern is rebuilt whenever vocabulary changes — cheap and infrequent. Lookbehind
requires a modern engine, guaranteed by `minimum_chrome_version: 110`. A very large vocabulary would
eventually produce an unwieldy pattern; a trie is the escape hatch if that ever materialises.

---

## ADR-009 — Optimistic UI with reload on failure

**Problem.** Favourite toggles lagged visibly, and controlled checkboxes on the options page reverted
to their previous value mid-interaction before settling. Caught by E2E.

**Root cause.** State was set only from the resolved value of an async write, so React re-rendered the
stale value for the duration of the IndexedDB round trip.

**Chosen.** Apply the change to React state immediately, then persist; on failure, reload from storage
to discard the optimistic value.

**Reason.** Local writes essentially always succeed, so optimising for the success path is correct.

**Trade-offs.** A failed write briefly shows the wrong value before correcting.

---

## ADR-010 — E2E fixtures served over HTTP

**Problem.** The first highlighting E2E test found zero highlights, while the feature worked when
driven manually.

**Root cause.** The fixture page was a `data:` URL. Content scripts registered for `<all_urls>` are
not injected into `data:` URLs.

**Options considered.** Weaken the assertion (hides the bug); load a file from disk (`file://` has its
own injection rules); serve the fixture from a throwaway local HTTP server.

**Chosen.** A `node:http` server on an ephemeral port, started and stopped by a Playwright fixture.

**Reason.** Tests should exercise the same injection path as reality. This choice is what turned a
silent failure into a provable one.

**Trade-offs.** A few lines of fixture setup and a port binding per test.

---

## ADR-011 — `no-undef` disabled for TypeScript

**Problem.** ESLint reported 149 `no-undef` errors, largely for the ambient `chrome` global.

**Chosen.** Disable the core `no-undef` rule for `.ts`/`.tsx`.

**Reason.** The rule cannot see TypeScript's ambient declarations, and TypeScript already performs
strictly better undefined-symbol analysis. This is the configuration `typescript-eslint` recommends.

**Trade-offs.** None for TypeScript files. Plain JavaScript config files would lose the check; there
are effectively none left, since the Tailwind config is now TypeScript.

---

## ADR-012 — A single design token module for two styling paths

**Problem.** The popup and options pages are styled with Tailwind, but the content script injects a
hand-built CSS string into third-party pages. Colours were hardcoded in both places, so they could
drift and neither could be changed centrally.

**Options considered.**

| Option | Assessment |
| --- | --- |
| Tailwind in the content script too | Its preflight would restyle the host page; utilities would have to be shipped wholesale. |
| Duplicate the palette in both places and keep them in sync by convention | Guaranteed to drift. |
| **One TypeScript token module consumed by both** | **Chosen.** |

**Chosen.** `src/shared/styles/tokens.ts` is the single source of truth. `tailwind.config.ts` imports
it for the utility palette; `src/content/styles.ts` interpolates the same values into its injected
CSS.

**Reason.** The two paths exist for a real platform reason and cannot be merged, so the values they
share must be. A convention alone would not hold.

**Trade-offs.** The Tailwind config must be TypeScript to import typed tokens, and readonly `as const`
arrays need spreading where Tailwind expects mutable ones.

**Enforcement.** `src/shared/styles/tokens.test.ts` asserts that Tailwind's palette is the token
object and that every hex literal in the injected stylesheet is a known token. Hardcoding a colour
fails the test suite. See [Design system](DESIGN_SYSTEM.md).

---

## ADR-014 — Retry and rate-limit only transient AI failures

**Problem.** The engineering standard requires retries, timeouts and rate limiting for AI calls. A
naive implementation would retry every failure and burst the provider.

**Options considered.**

| Option | Assessment |
| --- | --- |
| Retry every error | Replays `unauthorized`/`bad_response`, wasting the user's money and quota with no chance of success |
| No retry at all | A transient 429 or 5xx forces the user to retry by hand |
| **Retry only transient codes, with backoff, behind a shared rate limiter** | **Chosen.** |

**Chosen.** `withRetry()` (src/ai/retry.ts) retries `rate_limited`, `server_error`, `network` and
`timeout` up to three times with exponential backoff + jitter, capped at 10 s. `createRateLimiter()`
(src/ai/rate-limiter.ts) is a shared token bucket (5 req / 10 s) so concurrent requests do not burst the
provider. Aborts fail immediately and are honoured during backoff.

**Reason.** Retrying permanent failures is actively harmful for a bring-your-own-key product — it spends
the user's quota. Retrying transient failures is purely beneficial. The rate limiter prevents a new
failure mode (self-inflicted 429s) that auto-explain would otherwise introduce.

**Trade-offs.** Calls can now take longer under sustained failure (backoff up to ~3.5 s across three
attempts). Acceptable: the user is blocked on this call anyway, and it is bounded by the existing 30 s
timeout.

**Future considerations.** If a provider returns a `Retry-After` header, honouring it would refine the
backoff. Streaming (not yet implemented) would bypass the simple retry wrapper.

---

## ADR-013 — Settings in `chrome.storage.local`, not IndexedDB

**Problem.** Settings could live alongside vocabulary in IndexedDB.

**Chosen.** Settings live in `chrome.storage.local` under the key `avs:settings`.

**Reason.** Two properties IndexedDB does not offer. First, content scripts need settings cheaply on
every page load, and `chrome.storage` is a simple synchronous-feeling read rather than a database
open. Second, `chrome.storage.onChanged` provides a cross-context change event, which is what makes
[ADR-007](#adr-007--the-content-script-observes-storage-directly) possible.

**Trade-offs.** Two storage mechanisms instead of one, and export must read from both. Settings are
also subject to `chrome.storage.local` quota, which is irrelevant at this size.

**Future considerations.** Anything needing cross-surface change notification belongs here; anything
needing querying or growth belongs in IndexedDB.

---

## ADR-015 — Multi-provider model with active/fallback and per-provider config

**Problem.** The original settings stored a single provider (`provider`, `apiKey`, `model`, `baseUrl`).
The AI Provider Architecture standard requires users to save and switch between multiple providers,
configure each independently, and designate a fallback — none of which a single scalar field supports.

**Options considered.**

| Option | Assessment |
| --- | --- |
| Keep one provider, add a hardcoded fallback list in code | Violates "users control providers" and "adding a provider needs no business-logic change". |
| `providers: SavedProvider[]` + `activeProviderId` + `fallbackProviderId` | **Chosen.** A list the UI fully manages, with `ExplainService` resolving the active entry. |
| A map keyed by provider id | Less explicit about ordering/UI listing; arrays are simpler to render and order. |

**Chosen.** Settings are now `{ providers: SavedProvider[], activeProviderId, fallbackProviderId }`.
`ExplainService.explain()` reads the active `SavedProvider`, checks the in-memory cache, then runs through
rate-limit + retry; on a transient failure it retries **once** against `fallbackProviderId` (hard errors
such as a bad key are never retried). Each `SavedProvider` carries its own `apiKey`, `baseUrl`, `model`,
`temperature`, `maxTokens` and `timeoutMs`. A `custom` provider type lets users point at any
OpenAI-compatible endpoint. `SettingsRepository.get()` migrates the legacy single-provider shape forward
so existing installs keep working.

**Reason.** The provider list is data the UI owns, so adding/removing/switching providers is a pure data
operation with zero business-logic change — exactly the standard's "adding a provider requires minimal
changes" (new presets are still a one-line data entry; new wire formats are one adapter file). Fallback
is opt-in and bounded to a single retry to avoid quota surprises.

**Trade-offs.** A small migration shim lives in `SettingsRepository`; settings are now a list, so consumers
resolve the active entry rather than reading a scalar. The cache is in-memory only (cleared on service-
worker eviction) — acceptable because explanations are also persisted on the entry.

**Enforcement.** `settings-repository.test.ts` covers migration and merge; `explain-service.test.ts`
covers provider resolution, the missing-key guard and fallback; `registry.test.ts` guarantees every
`AI_PROVIDER_IDS` entry resolves.
