# Chrome Web Store Release Checklist — Vocab 1.0.0

## Pre-submission

- [x] **Manifest V3** — `manifest_version: 3` (scripts/manifest.ts).
- [x] **Version 1.0.0** — `package.json` version set to `1.0.0`; manifest reads it.
- [x] **Minimal permissions** — `storage`, `contextMenus`, `activeTab`, `unlimitedStorage`.
- [x] **Minimal host permissions** — `<all_urls>` (required: content script runs on pages you browse; service worker fetches your configured AI/translate endpoints).
- [x] **Production build works** — `npm run build` produces `dist/` with `manifest.json` at root.
- [x] **No secrets in bundle** — API keys are user-supplied at runtime, never hardcoded; verified by source audit.
- [x] **No localhost URLs in shipped code** — LM Studio / Ollama `localhost` presets are optional provider defaults (only used if the user selects them), not active calls.
- [x] **No development code** — removed `shot.mjs`, `shot_quiz_real.mjs`, `.newdesign_mockup*.png`.
- [x] **No unnecessary permissions** — none beyond the above.
- [x] **Privacy policy ready** — `PRIVACY_POLICY.md` (host it at a stable URL and paste that URL into the listing).
- [x] **Store description ready** — `store/description.md` (name, short + full description).
- [x] **Screenshots ready** — `store/screenshot-1..4.png` (real product UI) + `store/icon-128.png`.
- [x] **Icon ready** — 16/32/48/128 px present in `public/assets/` and emitted to `dist/assets/`.

## Testing

- [x] **Typecheck** — `npm run typecheck` (tsc --noEmit) passes.
- [x] **Lint** — `npm run lint` (eslint) passes.
- [x] **Unit tests** — `npm run test` (vitest) passes (644 tests).
- [x] **Build** — `npm run build` succeeds, `dist/manifest.json` valid.

## Manual verification (clean install in Chrome)

- [ ] Extension loads from `chrome://extensions` → Load unpacked (`dist/`) with no manifest errors.
- [ ] No console errors in the service worker or popup.
- [ ] Content script injects on a web page; saved words highlight.
- [ ] Popup opens; Library lists saved words; AI explain works (with a configured provider).
- [ ] Translation works (keyless Google fallback).
- [ ] Save vocabulary via toolbar / context menu / shortcut works.
- [ ] Vocab Radar generates and highlights after explaining a word.
- [ ] Reload extension (worker update) works without breaking state.
- [ ] Fresh install (no prior data) works.

## Packaging

- [x] **Chrome Web Store ZIP generated** — `vocab-chrome-store-1.0.0.zip`.
- [x] **ZIP contains manifest.json at root** — `vocab-chrome-store-1.0.0.zip` holds `dist/` contents directly (manifest.json, background.js, content.js, assets/, src/).

## Before clicking "Publish"

- [ ] Host `PRIVACY_POLICY.md` at a public URL and enter it in the listing's "Privacy policy" field.
- [ ] Replace the placeholder privacy contact (`[INSERT PRIVACY CONTACT EMAIL / URL]`) with a real, monitored address.
- [ ] Confirm the store listing's single purpose reads: "Helping users discover, understand, save, and learn vocabulary while browsing the web."
- [ ] Upload `store/icon-128.png` as the store icon and `store/screenshot-1..4.png` as listing screenshots.
- [ ] Set the store category (e.g., "Education" / "Productivity").

## Known limitations / notes

- `host_permissions: <all_urls>` triggers Chrome's "read and change all your data on all websites" warning. This is inherent to a "highlight vocabulary on any page you browse" extension and is justified by the single purpose. Be ready to justify it in the optional "permission justification" field if Google requests it.
- Local-model providers (Ollama/LM Studio) use `localhost` endpoints; these are user-opt-in and not active by default.
