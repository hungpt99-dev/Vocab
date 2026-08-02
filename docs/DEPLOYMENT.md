# Deployment

For this project "deployment" means producing a loadable or publishable browser
extension artifact. There is no backend, no server and no account system, so there
is nothing to deploy to a host. The deliverable is either:

- a local `dist/` folder that a user loads unpacked, or
- a packaged `ai-vocabulary-saver.zip` that is uploaded to the Chrome Web Store or
  distributed directly.

See [Architecture](ARCHITECTURE.md) for why the extension is local-first, and
[Security](SECURITY.md) for the data-handling model that shapes the store listing.

## Local unpacked install

This is the path for development, testing and internal distribution.

```bash
npm install
npm run build      # writes dist/
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select the `dist/` directory.

No further steps are required. The user opens the popup, goes to **Settings** and
adds their own AI provider key.

## Building the distributable zip

```bash
npm run package
```

This runs the production build and then zips `dist/` (excluding `*.map`) into
`ai-vocabulary-saver.zip` at the repository root. Verified output for v0.1.0:

- `ai-vocabulary-saver.zip` is about **103 KB** (16 zip entries: 12 files plus 4
  directory entries).
- A clean `npm run build` produces **12 files** in `dist/`:

| Path | Purpose |
| --- | --- |
| `manifest.json` | Generated Manifest V3 manifest (derived from `package.json` version). |
| `background.js` | Service worker (ESM). |
| `content.js` | Content script (single IIFE). |
| `src/popup/index.html` | Popup entry. |
| `src/options/index.html` | Options entry. |
| `assets/popup-<hash>.js` | Popup bundle. |
| `assets/options-<hash>.js` | Options bundle. |
| `assets/client-<hash>.js` | Shared client bundle. |
| `assets/explain-service-<hash>.js` | AI explain service bundle. |
| `assets/vocabulary-repository-<hash>.js` | Storage repository bundle. |
| `assets/tailwind-<hash>.js` | Tailwind runtime. |
| `assets/tailwind-<hash>.css` | Compiled styles. |

The `<hash>` suffixes are content hashes assigned at build time and change between
builds. Do not reference them directly; `manifest.json` already points at the
correct popup/options HTML, and `background.js` / `content.js` use stable names.

> Note: `npm run package` uses `zip -r`, which merges into an existing archive.
> Delete `ai-vocabulary-saver.zip` before running it if you need a clean file.

## Chrome Web Store submission

**Status: the store listing has not been published yet.** The steps below describe
the intended process; none have been completed for v0.1.0.

Required assets and information for a store submission:

- **Listing copy** — short description, detailed description, category
  (Productivity / Language), and the privacy disclosure.
- **Screenshots** — at least one 1280×800 (or 640×400) image of the popup,
  options and an in-page highlight.
- **Icon** — a 128×128 PNG. **This is currently missing** (see
  [Known Limitations](KNOWN_LIMITATIONS.md)); Chrome falls back to a placeholder
  puzzle-piece icon until real artwork is added.
- **Privacy disclosures** — because the extension collects no user data and makes
  no network calls except the user-initiated AI request to the provider they
  chose, the data-use form is minimal. State plainly: no personal data is
  collected, transmitted or stored by the project.

### Permission justifications reviewers will ask for

The manifest requests the following; each needs a plain justification in the
submission:

| Permission | Why the extension needs it |
| --- | --- |
| `storage` | Persist settings and the API key in `chrome.storage.local`. |
| `contextMenus` | The "Save … to vocabulary" right-click menu item. |
| `activeTab` | Read the selected text and current tab when the user invokes capture. |
| `scripting` | Inject the highlighter and hover UI into the active page. |
| `unlimitedStorage` | Vocabularies can grow large; raise IndexedDB quota concerns on some profiles. |
| `host_permissions: <all_urls>` | Highlight and capture on any page the user browses. |

A consistent, honest message for reviewers: the extension is local-first, the key
is the user's own, and outbound traffic is limited to provider calls the user
triggers.

## Self-hosting and enterprise distribution

For environments that cannot use the public store:

- **Direct zip** — share `ai-vocabulary-saver.zip`; recipients unzip and use
  **Load unpacked** pointing at the extracted `dist/`.
- **Chrome for Enterprise / group policy** — deploy the unpacked directory (or a
  signed `.crx` if you run your own update server) via the
  `ExtensionInstallForcelist` policy on Windows, macOS or Linux. The extension
  requires no network egress beyond the user's chosen AI provider, which simplifies
  most security reviews.
- **Internal store** — if your organisation runs a Chrome Web Store private
  collection, upload the same zip used for the public listing.

There is no telemetry or phone-home, so no allow-list entries beyond the AI
provider domains the user configures are required.
