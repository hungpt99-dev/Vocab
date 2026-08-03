# Product Requirements

Requirements are written so each is independently verifiable. Identifiers are stable and referenced
from Linear issues and tests.

- **FR** — functional requirement
- **NFR** — non-functional requirement

Status reflects the current release, v0.1.0. See [Roadmap](ROADMAP.md) for what is planned and
[Known limitations](KNOWN_LIMITATIONS.md) for what is deliberately absent.

---

## 1. Capture

| ID | Requirement | Status |
| --- | --- | --- |
| FR-1.1 | The user can save the current text selection from the right-click context menu. | Done |
| FR-1.2 | The user can save the current selection with a keyboard shortcut (`Ctrl+Shift+S`, `Cmd+Shift+S` on macOS). | Done |
| FR-1.3 | The user can save a word from the popup, which prefills the active tab's selection. | Done |
| FR-1.4 | The user can type a word manually when nothing is selected. | Done |
| FR-1.5 | Each entry stores word, phrase, surrounding sentence, source URL, page title, note, tags, favourite flag and creation timestamp. | Done |
| FR-1.6 | Saving the same word twice updates the existing entry rather than creating a duplicate. | Done |
| FR-1.7 | Capture confirms with an on-page toast that does not require dismissal. | Done |
| FR-1.8 | Optionally, an explanation is requested automatically when a word is saved. | Done (off by default) |

**Acceptance criteria.** Selecting text on any HTTP(S) page and using any of the three routes produces
exactly one entry containing the selected text, the sentence containing it, and the page URL. The page
is not navigated, reloaded or visually disturbed beyond a transient toast.

**Edge cases.**

| Case | Required behaviour |
| --- | --- |
| Empty or whitespace-only selection | No entry created; the popup form does not submit. |
| Selection spanning multiple elements or block boundaries | Text is normalised to a single whitespace-collapsed string. |
| Selection longer than a phrase (a paragraph) | Accepted and stored; the library truncates for display rather than rejecting. |
| Word already saved | Existing entry is updated; no duplicate; the user is told it was saved. |
| Page with no extractable sentence (e.g. a bare heading) | Entry is still created; the sentence field may be empty. |
| Restricted page (`chrome://`, the Web Store, PDF viewer) | Capture is unavailable because content scripts cannot run. Documented, not an error state. |
| Selection inside an input, textarea or contenteditable | Capture works; highlighting deliberately skips these regions. |

---

## 2. Vocabulary library

| ID | Requirement | Status |
| --- | --- | --- |
| FR-2.1 | Entries are listed newest first. | Done |
| FR-2.2 | Search matches word, note, sentence and tags, and is debounced. | Done |
| FR-2.3 | Entries can be filtered to favourites only. | Done |
| FR-2.4 | Entries can be filtered by tag. | Done |
| FR-2.5 | An entry can be edited in place (word, note, tags). | Done |
| FR-2.6 | An entry can be deleted, behind an explicit confirmation. | Done |
| FR-2.7 | An entry can be toggled favourite. | Done |
| FR-2.8 | Tags are normalised and de-duplicated. | Done |
| FR-2.9 | The list shows an entry count and an empty state when there is nothing to show. | Done |

**Acceptance criteria.** With entries saved, typing in the search field narrows the list without a
page reload and without losing focus. Every mutation is reflected immediately in the popup and
persisted across popup close/reopen.

**Edge cases.** Search with no matches shows an empty state, not a blank panel. Deleting the last
entry returns to the first-run empty state. Editing a word to one that already exists merges rather
than creating a duplicate (consistent with FR-1.6).

---

## 3. Highlighting

| ID | Requirement | Status |
| --- | --- | --- |
| FR-3.1 | Saved words are highlighted on every page the user visits. | Done |
| FR-3.2 | Matching respects word boundaries; `cake` does not match `cupcakes`. | Done |
| FR-3.3 | Multi-word phrases match, and the longest match wins. | Done |
| FR-3.4 | Hovering a highlight shows meaning, note and saved date. | Done |
| FR-3.5 | Highlights are keyboard focusable and the card is dismissible with `Escape`. | Done |
| FR-3.6 | Content added after page load is highlighted. | Done |
| FR-3.7 | Highlight colour is user-configurable and applies to open pages immediately. | Done |
| FR-3.8 | Highlighting can be disabled entirely, taking effect on open pages immediately. | Done |

**Acceptance criteria.** After saving a word, loading a page containing it shows every occurrence
highlighted. Changing the colour or toggling the feature updates already-open tabs without a reload.

**Edge cases.**

| Case | Required behaviour |
| --- | --- |
| Word appears inside `<script>`, `<style>`, `<code>`, an input, or contenteditable | Not highlighted. Rewriting these would break pages or user input. |
| Word appears inside an existing highlight | Not re-processed. Repeat scans are idempotent. |
| Very large or infinitely scrolling page | Scanning is batched and idle-scheduled; the page must remain responsive. |
| Page mutates rapidly (a live feed) | Mutation handling is batched, not per-mutation. |
| Vocabulary is empty | No scanning work is performed. |
| Two saved words overlap in the text | The longer phrase wins; no nested or double highlighting. |

---

## 4. AI explanation

| ID | Requirement | Status |
| --- | --- | --- |
| FR-4.1 | The user can request an explanation for any entry. | Done |
| FR-4.2 | An explanation contains meaning, simple explanation, examples, synonyms, pronunciation and collocations. | Done |
| FR-4.3 | Six providers are supported: OpenAI, OpenRouter, Google Gemini, Anthropic, Ollama, LM Studio. | Done |
| FR-4.4 | The user supplies their own key; local providers need none. | Done |
| FR-4.5 | Explanations are cached on the entry and reused until explicitly refreshed. | Done |
| FR-4.6 | Provider errors are reported in plain language with a stable error code. | Done |
| FR-4.7 | Connectivity can be verified from Settings before saving words. | Done |
| FR-4.8 | Responses stream token-by-token. | **Not implemented** — see [Known limitations](KNOWN_LIMITATIONS.md) |
| FR-4.9 | Failed requests are retried automatically with backoff. | **Not implemented** — see [Known limitations](KNOWN_LIMITATIONS.md) |
| FR-4.10 | Selecting text and clicking "Explain with AI" opens a popover with structured, expandable sections tailored to the unit (word / phrase / sentence); the AI is called only when the user clicks Explain, and the full context (selection, surrounding paragraph, page title, URL, detected and target languages) is sent to the provider. | Done |

**Acceptance criteria.** With a valid key, requesting an explanation returns a populated structured
result. With an invalid key, the user sees an `unauthorized` message naming the problem, and no
partial or corrupted entry is written.

**Edge cases.**

| Case | Required behaviour |
| --- | --- |
| No API key set for a provider that requires one | Request is refused locally with `missing_api_key`; no network call. |
| Provider returns prose or a fenced code block around the JSON | Parsed successfully; see [AI providers](AI_PROVIDER.md). |
| Provider returns a scalar where a list is expected | Coerced to a list rather than failing. |
| Provider returns no usable meaning | Treated as `bad_response`; the entry is left unchanged. |
| Request exceeds the timeout, or the popup closes mid-request | Aborted cleanly; no partial write. |
| Rate limited | Surfaced as `rate_limited` so the user knows to wait rather than retry blindly. |
| Local provider (Ollama/LM Studio) is not running | Surfaced as a connection failure naming the base URL. |

---

## 5. Settings and data

| ID | Requirement | Status |
| --- | --- | --- |
| FR-5.1 | Provider, API key, model and base URL are configurable. | Done |
| FR-5.2 | Model and base URL default sensibly per provider when left blank. | Done |
| FR-5.3 | Highlight colour and enable/disable are configurable. | Done |
| FR-5.4 | Vocabulary can be exported as versioned JSON. | Done |
| FR-5.5 | Vocabulary can be imported, with merge or replace strategies. | Done |
| FR-5.6 | The API key input is masked. | Done |
| FR-5.7 | Settings persist across browser restarts. | Done |

**Acceptance criteria.** Settings changed on the options page survive a reload and are observed by
open content scripts. Exported JSON re-imports into a clean profile and reproduces the library.

**Edge cases.** Importing a malformed or non-JSON file reports a readable error and changes nothing.
Importing a file from a future schema version is rejected rather than partially applied. Merge keeps
the newer of two entries with the same word key; replace clears existing data first and warns before
doing so.

---

## Non-functional requirements

| ID | Requirement | Target | How it is verified |
| --- | --- | --- | --- |
| NFR-1 | Popup opens quickly enough to feel instant | < 300 ms to interactive | E2E asserts the form is visible without an explicit wait |
| NFR-2 | Highlighting does not make pages feel slow | Single pass, batched, idle-scheduled | Design constraint; see [System design](SYSTEM_DESIGN.md) |
| NFR-3 | No console errors on any surface | Zero | E2E test fails on any `console.error` or page error in the popup |
| NFR-4 | Keyboard accessible | Every control reachable and named | E2E asserts no interactive element lacks an accessible name |
| NFR-5 | Responsive popup | Usable at 320 px with no horizontal overflow | E2E asserts `scrollWidth <= clientWidth` at 320 px |
| NFR-6 | Data durability | No data loss on crash or update | IndexedDB; export available |
| NFR-7 | Privacy | No outbound request except user-triggered AI calls | [Security](SECURITY.md) |
| NFR-8 | Type safety | No `any` in production code | `@typescript-eslint/no-explicit-any` is an error |
| NFR-9 | Test coverage of logic | All repositories, adapters and pure logic unit-tested | 187 unit tests; see [Testing](TESTING.md) |
| NFR-10 | Bundle size | Packaged artifact stays small | Currently ~100 KB zipped |
| NFR-11 | Browser support | Chrome/Edge 110+ | `minimum_chrome_version` in the manifest |
| NFR-12 | Dark mode | Follows the OS setting | `darkMode: 'media'`; see [Design system](DESIGN_SYSTEM.md) |

---

## Success metrics

The project collects no telemetry ([Security](SECURITY.md)), so these are evaluated from user reports,
issues and manual testing rather than measured automatically. They are stated as targets to design
against, not dashboards.

| Metric | Target | Rationale |
| --- | --- | --- |
| Time to save a word | Under two seconds from selection to confirmation | Above this, users stop bothering |
| Steps to save | One deliberate action | The core value proposition |
| Setup time for a new user | Under five minutes including obtaining an API key | Onboarding is the main drop-off point |
| Explanation success rate with a valid key | Effectively always | Parsing is tolerant precisely to protect this |
| Crash or data-loss reports | Zero | Local data has no backup unless the user exports |
| Documentation accuracy | Every documented command and path works | Verified in review; see [Contributing](CONTRIBUTING.md) |

---

## Out of scope

Deliberately excluded from the product. See [Project overview](PROJECT_OVERVIEW.md#non-goals) for
reasoning and [Roadmap](ROADMAP.md#considered-and-deliberately-deferred) for revisit conditions.

- Cloud sync, user accounts, a hosted backend of any kind
- A project-supplied or proxied API key
- Full spaced-repetition scheduling comparable to Anki
- General-purpose translation or a bundled dictionary
- Mobile applications (Chrome on mobile does not support extensions)
- Telemetry, analytics or crash reporting
- Social features: sharing, leaderboards, public word lists
- Firefox and Safari builds in v0.1.0 (see [Roadmap](ROADMAP.md))
