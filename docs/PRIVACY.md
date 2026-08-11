# Privacy

What this extension does with data — written to be the single source of truth
for the Chrome Web Store privacy form and for curious users. Every claim below
was verified against the v0.1.0 build. If the code changes and this doc stops
matching, that is a release-blocking bug.

Related: [Security](SECURITY.md#data-flows), [Storage](STORAGE.md),
[Store listing](STORE_LISTING.md).

---

## The short version

- **No account. No sign-in. No telemetry. No analytics. No ads. No backend.**
- Your vocabulary, notes and tags are stored **only in your browser**
  (IndexedDB + `chrome.storage.local`).
- Two things ever go out over the network:
  1. **Your AI provider** — when *you* trigger an explanation, the selected
     word and its sentence are sent to the provider *you* configured, using
     *your* API key. No key from us, no third party.
  2. **Google's keyless Translate endpoint** — for the reading features
     (bilingual reading, quick translations), snippets of the *page you are
     reading* are sent to `translate.googleapis.com`, the same public endpoint
     the Google Translate widget uses. No API key involved, and Google stores
     nothing for keyless anonymous requests.
- Nothing else. No "device identifiers", no crash reports, no CDN fonts.

---

## Data stored locally

| Data | Where | Why |
| --- | --- | --- |
| Vocabulary entries (word, sentence, source URL/title, note, tags, favorite, explanation) | IndexedDB (`ai-vocabulary-saver`) | The library — nothing else can do the job offline and locally |
| Review schedule (ease, interval, due date) | IndexedDB, `review` table | Spaced-repetition queue |
| Settings incl. your API key(s) | `chrome.storage.local` under `avs:settings` | BYO-key configuration |
| Reading preferences | `chrome.storage.local` under `avs:reading` | Reader layout/font preferences |

All of it is deletable from the **Your data** tab in Options (clear, export,
import). Uninstalling the extension removes every trace.

**On API keys:** the key is the user's own credential and is never
transmitted anywhere except to the provider it belongs to. It is not exported
with backups, not logged, and masked in the UI.

---

## What is sent where

| When | What is sent | To | Needs a key? | Off switch |
| --- | --- | --- | --- | --- |
| AI: word is explained (button, "Explain" action, or auto-explain-on-save) | The word and its sentence context | Your configured provider (OpenAI / Anthropic / Gemini / OpenRouter / Ollama / LM Studio / custom) | Yes, yours | Auto-explain is off by default; every other call is an explicit click |
| Bilingual reading is open on a page | Sentences, paragraphs and words of the current page | `translate.googleapis.com` | No | Turn off in Options → Bilingual reading, or close the reader on the page (Alt+Shift+R) |
| Selection card / popup quick translation | The selected or saved word | `translate.googleapis.com` | No | Settings → popup translation toggle; the in-page card is per-selection |
| Connection test in Options | Minimal probe request | Your configured provider | Yes, yours | Only on click |

**Bilingual reading is enabled by default** because it is the headline feature
— this means opening a page can send parts of that page's text to Google's
keyless endpoint. Pages with no article-like content are not translated
(empty matches are skipped), and the reader never sends the whole DOM, only
extracted prose blocks already / about to be visible. Verifiable in
`src/content/reading/`. Turning the feature off in Options stops all of it.

**What is never sent anywhere:** your full library, notes, tags, saved
URLs, browsing history, the API key (except to its own provider), and
anything when you are not reading, selecting or explaining.

---

## What third parties see

1. **Your AI provider** receives the word/sentence you chose to explain, from
   your IP. Their data-use terms apply. A local model (Ollama, LM Studio) keeps
   even this on your machine.
2. **Google** receives page snippets for keyless translation, from your IP.
   This is the anonymous public endpoint; nothing is logged to your accounts
   and you do not need to be signed in for it to work.

No other party sees anything, ever.

---

## Collection and use

| Question | Answer |
| --- | --- |
| Do you collect personal data? | **No.** |
| Do you sell personal data? | **No** — there is none to sell. |
| Is use required for a core function? | N/A — nothing is collected. |
| Do you process data in a way that hasn't been disclosed? | **No.** This document is the complete disclosure. |
| Do you use cookies? | No. |
| Do you use analytics / trackers? | None. Remote code is not loaded; the extension is fully bundled. |

---

## Store privacy form answers

Paste-ready for the Chrome Web Store developer dashboard privacy page:

**Single purpose:** *Save, review and AI-explain vocabulary words while
browsing, with bilingual reading support.*

**Justification for permissions & data use (text box):**
*The extension is local-first. It stores the user's own vocabulary and
settings (including the API key the user supplies for their chosen AI
provider) exclusively in the browser profile. It has no backend, account or
telemetry. Outbound traffic is limited to (a) the user's configured AI
provider, called only when the user triggers an explanation, and (b) Google's
public keyless Translate endpoint (translate.googleapis.com), used by the
bilingual-reading and quick-translation features. No personal data is
collected, sold or disclosed; users free of all outbound traffic can disable
these features in Settings.*

**Data collection checkboxes:** all "No".

**Declare permissions:** `storage` — persist settings and user-supplied API
key locally; `contextMenus` — right-click "Save to vocabulary"; `activeTab` —
read the user's selection when they invoke capture; `unlimitedStorage` —
vocabularies can grow beyond the default quota; `<all_urls>` host permission —
highlight saved words and enable bilingual reading on any page the user
reads.

---

## Removing data

- Options → **Your data** tab: clear everything, export a backup, or import.
- Uninstall the extension: IndexedDB and `chrome.storage.local` for the
  extension origin are removed with the uninstall.