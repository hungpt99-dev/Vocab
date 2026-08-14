# Development

This document covers local setup and the day-to-day commands for working on AI
Vocab. For the module layout and build rationale, see
[Architecture](ARCHITECTURE.md); for the test strategy see [Testing](TESTING.md).

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20 or newer | The CI matrix pins Node 20; `npm` ships with Node. |
| Chromium-based browser | Chrome/Chromium 110+ | Required to load the unpacked extension (`minimum_chrome_version` is `110`). |
| Display (for E2E) | — | Chrome extensions cannot run headless; `npm run test:e2e` wraps Playwright in `xvfb-run` on Linux. |
| Playwright Chromium | installed on demand | `npx playwright install --with-deps chromium` (the CI `e2e` job does this). |

A backend or API key is not needed to build or run the extension. To exercise the
AI Explain feature you supply your own provider key in the options page at runtime.

## First-time setup

```bash
git clone <this-repo>
cd ai-vocab-saver
npm install
npm run build      # produces dist/
```

Load the extension:

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the generated `dist/` folder.

The toolbar icon appears after load. Open it and click **Settings** to add an AI
provider key. For a longer walkthrough, see the root [README](../README.md).

## npm command reference

Every script below is defined in `package.json`. Run them with `npm run <script>`.

| Script | Command | What it does | When to use it |
| --- | --- | --- | --- |
| `dev` | `vite build --watch --mode development` | Watch build into `dist/` (development mode, no minification profiling). | Active coding; rebuilds on file change so you can reload the extension. |
| `build` | `npm run build:app && npm run build:content` | Full production build (app bundle + content script). | Before packaging, after changes, in CI. |
| `build:app` | `vite build` | Builds popup, options and the service worker via `vite.config.ts`. | When you only touched app surfaces. |
| `build:content` | `vite build --config vite.content.config.ts` | Builds the content script as a single IIFE bundle. | When you only touched the content script. |
| `typecheck` | `tsc --noEmit` | Type-checks the whole project in strict mode without emitting. | Catch type errors before committing; part of the CI `quality` gate. |
| `lint` | `eslint .` | Lints all sources. The PR gate requires **zero warnings**. | Before committing; part of CI. |
| `lint:fix` | `eslint . --fix` | Lints and auto-fixes what ESLint can rewrite. | Clean up formatting/import issues; resolve remaining warnings by hand. |
| `format` | `prettier --write "src/**/*.{ts,tsx,css}"` | Formats TypeScript/TSX/CSS via Prettier (config in `.prettierrc.json`). | Tidy a branch; CI does not enforce this gate but it keeps diffs small. |
| `test` | `vitest run` | Runs the unit suite once (187 tests across 23 files, jsdom + fake-indexeddb). | Verify behaviour; part of CI. |
| `test:watch` | `vitest` | Runs the unit suite in watch mode. | TDD loop while editing. |
| `test:coverage` | `vitest run --coverage` | Runs unit tests with the v8 coverage reporter (text + html). | Check coverage of changed code. |
| `test:e2e` | `npm run build && xvfb-run -a playwright test` | Builds, then runs the Playwright suite against the real unpacked extension. | Validate end-to-end behaviour (14 tests across 3 specs). |
| `package` | `npm run build && cd dist && zip -r ../vocab.zip . -x '*.map'` | Builds, then zips `dist/` (excluding source maps) into `vocab.zip`. | Produce a distributable artifact. |

## The two-config build

The extension ships two separate bundles because Chrome imposes different module
rules on each surface:

- **App bundle** (`vite.config.ts`) — builds `popup`, `options` and `background`
  (service worker) as standard ES modules, targeting `chrome110`. The service
  worker is emitted as a stable `background.js` so `manifest.json` can reference
  it directly; other chunks are content-hashed under `assets/`.
- **Content script bundle** (`vite.content.config.ts`) — builds `src/content/index.ts`
  as a single **IIFE** (`formats: ['iife']`, `inlineDynamicImports: true`) and
  emits `content.js`. Chrome injects content scripts as classic scripts, so ES
  module syntax (`import`/`export`) is rejected. Inlining everything into one
  self-executing bundle is required for the script to load at all.

`scripts/manifest.ts` generates the Manifest V3 object and is written to
`dist/manifest.json` by `scripts/crx-manifest-plugin.ts` at the end of the app
build. The content build runs with `emptyOutDir: false` so it does not delete the
app output.

## Watch mode and reloading

`npm run dev` starts Vite in watch mode. It writes to `dist/` on every change, but
**Chrome does not hot-reload an unpacked extension** — you must reload it:

1. Keep `npm run dev` running in a terminal.
2. After a change, open `chrome://extensions`.
3. Click the reload icon (⟳) on the **Vocab** card.

Reload behaviour by surface:

| Surface | Pick up changes by |
| --- | --- |
| Popup / Options | Reopen the surface after a reload; HTML/JS updates apply on next open. |
| Service worker | Reload the extension; the worker is re-registered. |
| Content script | Reload the extension, then reload the tab where it is injected. |

If a change does not appear, confirm `dist/` actually rebuilt and that the
extension card was reloaded — stale loaded state is the usual cause.

## Debugging the four surfaces

**Popup and Options**
Right-click the popup and choose **Inspect**, or open the options page from the
extension card (**Details → Extension options**) and use its DevTools. Both are
standard web pages, so React DevTools, the console and the network panel all work.

**Service worker (MV3 background)**
Open `chrome://extensions`, find **Vocab**, and click the
**Inspect views: service worker** (or **View views**) link. This opens a DevTools
window scoped to the worker. Note that MV3 service workers are event-based and may
be terminated when idle; logs from a terminated worker persist in this inspect
view, but breakpoints only fire while the worker is alive.

**Content script**
Navigate to any page where the extension is active and open the page DevTools
(F12). The content script runs in an isolated world, so its `console.log` output
appears in the page console. To set breakpoints, open the **Sources** panel and
find `content.js` under the extension's injected sources. Because the script is a
single inlined IIFE, there are no separate module files to step through.

## Linting and formatting

- `npm run lint` must pass with **zero warnings** before a change is merged. The
  CI `quality` job fails on any lint error or warning.
- `npm run lint:fix` resolves auto-fixable issues; anything left must be fixed by
  hand (warnings are treated as errors in review).
- `npm run format` runs Prettier over `src/**/*.{ts,tsx,css}`. It is not a CI gate
  but keeps diffs consistent. Prettier configuration lives in `.prettierrc.json`.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Changes do not show up | The extension must be reloaded from `chrome://extensions` after a build (`npm run dev` rewrites files but Chrome caches the loaded extension). |
| Content script edits not applied | Reload the extension **and** the tab. Content scripts are re-injected only on reload. |
| E2E fails with a crash or "no display" | `test:e2e` needs a display. On a headless Linux box run under `xvfb-run` (already wrapped) or install a desktop session. |
| `tsc` errors in editor but `npm run build` passes | Run `npm run typecheck` for the authoritative strict check; the build uses Vite/esbuild, not `tsc` emit. |
| Lint reports warnings | Run `npm run lint:fix`, then resolve anything remaining by hand — the gate is zero-warning. |
| Stray `.js` files appear next to `.ts` sources | These are `tsc` artefacts. They are gitignored (`src/**/*.js`, `scripts/**/*.js`, `*.tsbuildinfo`) and must not be committed; the build is Vite-based, not `tsc` emit. |
| Playwright reports a missing browser | Run `npx playwright install --with-deps chromium`. |
| `npm run package` leaves old entries in the zip | The script uses `zip -r`, which merges into an existing archive. Delete `vocab.zip` first if you need a clean artifact. |
