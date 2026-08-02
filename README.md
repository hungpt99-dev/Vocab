# AI Vocabulary Saver

A lightweight, **local-first** Chrome extension that lets you save words and phrases while you browse,
highlights them on every page you visit, and explains them using **your own AI API key**.

No backend. No account. No cloud. No telemetry. Everything lives in your browser.

---

## Features

| Feature | Details |
| --- | --- |
| **Save a selection** | Right-click context menu, popup form, or `Ctrl+Shift+S` (`Cmd+Shift+S` on macOS) |
| **Rich capture** | Stores the word, phrase, surrounding sentence, source URL, your note and the creation time |
| **Vocabulary library** | Search, edit, delete, favourite and tag every entry |
| **On-page highlighting** | Saved words are highlighted everywhere; hover or focus shows meaning, note and saved date |
| **AI Explain** | Meaning, simple explanation, examples, synonyms, pronunciation (IPA) and collocations |
| **Bring your own key** | OpenAI, OpenRouter, Google Gemini, Anthropic, Ollama and LM Studio |
| **Portable data** | Versioned JSON export and import (merge or replace) |

---

## Install from source

```bash
git clone <this-repo>
cd ai-vocab-saver
npm install
npm run build
```

Then load it into Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the generated **`dist/`** folder

The extension icon appears in your toolbar. Open it and click **Settings** to add your API key.

---

## Configure an AI provider

Open the options page (popup → *Settings*) and choose a provider:

| Provider | API key | Default model | Notes |
| --- | --- | --- | --- |
| OpenAI | required | `gpt-4o-mini` | |
| OpenRouter | required | `openai/gpt-4o-mini` | Access many models with one key |
| Google Gemini | required | `gemini-1.5-flash` | |
| Anthropic | required | `claude-3-5-haiku-latest` | |
| Ollama | not required | `llama3.1` | Runs locally at `http://localhost:11434/v1` |
| LM Studio | not required | `local-model` | Runs locally at `http://localhost:1234/v1` |

Leave **Model** and **Base URL** blank to accept the defaults, or override them for proxies and local
servers. Use **Test connection** to verify your setup before saving words.

> Your API key is stored in `chrome.storage.local` and is sent only to the provider you selected.
> It never reaches any server operated by this project — there isn't one.

---

## Usage

**Save a word** — select text on any page, then right-click → *Save "…" to vocabulary*, press
`Ctrl+Shift+S`, or open the popup (the selection is prefilled) and click **Save to vocabulary**.

**Browse your library** — the popup lists everything newest-first. Search matches words, notes,
sentences and tags. Filter by favourites or by tag.

**Explain a word** — click **AI explain** on any entry. The result is cached on the entry and reused
until you click **Refresh explanation**.

**Highlighting** — saved words are highlighted on every page. Hover (or tab to a highlight) to see the
meaning, your note and the date you saved it. Change the colour or turn it off in Settings; open pages
update immediately.

**Back up** — Settings → *Export JSON*. Restore with *Import JSON* using either **merge** (keeps newer
entries) or **replace** (wipes first).

---

## Development

```bash
npm run dev          # watch build into dist/
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest unit tests
npm run test:e2e     # build, then Playwright against the real extension
npm run build        # production build
npm run package      # build and zip for distribution
```

E2E tests need a display because Chrome extensions cannot run headless; `npm run test:e2e` wraps
Playwright in `xvfb-run` for you on Linux.

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the module layout, **[DECISIONS.md](DECISIONS.md)** for
the reasoning behind key choices, and **[CONTRIBUTING.md](CONTRIBUTING.md)** to get set up.

---

## Privacy

* All vocabulary is stored in IndexedDB inside your browser profile.
* Settings (including your API key) live in `chrome.storage.local`.
* The only outbound network requests are the AI calls you trigger, sent directly to your chosen provider.
* Nothing is collected, analysed or transmitted anywhere else.

## License

MIT
