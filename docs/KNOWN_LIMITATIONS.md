# Known Limitations

An honest accounting of what this extension does **not** do, and what it does **imperfectly**. Two
kinds of entry live here: **non-goals** (deliberate, won't change without a premise shift) and
**unfinished work** (acknowledged, to be addressed). Blurring these would make the documentation
dishonest.

---

## Non-goals — by design

| Limitation | Reason it will not change |
| --- | --- |
| No cloud sync across devices | Local-first is the product premise; sync adds hosting, accounts and a breach surface |
| No project-supplied API key | Bring-your-own-key aligns cost and control with the user |
| No telemetry or analytics | Privacy is a feature, not a setting to disable |
| No Firefox/Safari support | Chromium MV3 is the target; other engines need separate effort |
| No storage of browsing history | Only the source URL of a *saved* word is kept |

---

## Unfinished work — acknowledged

These are known gaps to be closed, not permanent decisions.

| # | Limitation | Impact | Planned |
| --- | --- | --- | --- |
| L1 | ~~**No automatic retry** on AI failure~~ **Resolved** — transient failures now retry with backoff ([AI providers](AI_PROVIDER.md#retry-policy), [ADR-014](DECISION_LOG.md#adr-014--retry-and-rate-limit-only-transient-ai-failures)) | — | — |
| L2 | **No streaming** of explanations | Long generations feel slow; the full response waits on the network | Optional streaming method on `AiProvider`, with backoff-safe cancellation |
| L3 | **Highlighting cost on very large pages** | A page with many text nodes costs CPU per load; idle-batched, but not free | Bench a tokenised matcher if real-world pages show jank |
| L4 | **No bulk library operations** | Managing hundreds of words is one-by-one | Multi-select delete/tag/export |
| L5 | **No spaced-repetition review** | Recall is passive only; the learning loop is incomplete | A review mode is the top roadmap item ([Roadmap](ROADMAP.md)) |
| L6 | **No per-site highlight control** | The script runs on `<all_urls>`; no allow-list yet | Per-site lists are a roadmap candidate |
| L7 | **Settings are not exported** | A backup file does not carry the API key or preferences | Intentional for key safety; preferences export may be added separately |
| L8 | **No i18n** | UI is English-only | Locale scaffolding if contributors need it |
| L9 | **No automated store submission** | Releases are manual | The [release process](RELEASE_PROCESS.md) documents the manual steps |

---

## Platform restrictions (not bugs)

| Limitation | Cause |
| --- | --- |
| Highlighting and capture do not work on `chrome://` pages, the Chrome Web Store, or the built-in PDF viewer | Chrome forbids content scripts there |
| Highlighting does not work on `file://` URLs unless the user enables "Allow access to file URLs" | MV3 default |
| The keyboard shortcut may be claimed by another extension | Resolvable at `chrome://extensions/shortcuts` |
| An evicted service worker delays the first AI call after idle | MV3 lifecycle; the worker restarts on the next event |

---

## Things that look like limitations but are not

| Concern | Reality |
| --- | --- |
| "My API key could be stolen from local storage." | True that `chrome.storage.local` is not encrypted; this is inherent to BYO-key extensions and is disclosed in [Security](SECURITY.md). Mitigations: narrow key scope, spend caps, local models. |
| "Highlighting missed a word." | Usually a page the script is not allowed to run on, or the word was saved with different normalisation. The matcher is case-insensitive and whitespace-normalised. |
| "Explanations are slow." | Hosted models add network latency; there is no retry or streaming yet (L1, L2). |
