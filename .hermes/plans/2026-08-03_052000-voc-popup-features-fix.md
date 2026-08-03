# VOC Popup Features Fix — Implementation Plan

> **For Hermes:** Implement via the CodingAutomation worker (drive-voc.sh) after the in-flight polish run (VOC-59…64) finishes, so two workers don't touch the repo at once. Linear is the source of truth.

**Goal:** Make every popup feature actually work — specifically, the popup must load the active page selection (so Translate + selection-aware Save work) and toast messages must be consistent across surfaces.

**Architecture:** The popup talks to the background service worker over `chrome.runtime.sendMessage` (see `src/shared/messaging/client.ts`). The background registers handlers in `createHandlers` (`src/background/handlers.ts`). The content script already answers `get-selection` (`src/content/index.ts:36` → `readSelection()`), and `readActiveSelection()` (`handlers.ts:35`) forwards to the active tab — but `readActiveSelection` is **never wired as a background message handler**. So the popup's `get-selection` is rejected → `selection` stays null → `TranslatePanel` renders nothing and `SaveForm` has no context. Toasts are emitted inconsistently: content script uses `` `${action}: ${text}` `` (`src/content/index.ts:166` → `save: serendipity`) while the popup uses `Saved "word"`.

## Evidence (from e2e, `npm run test:e2e`)
- PASS: popup loads, saves, lists, searches, edits, deletes, highlights, options, exports.
- PASS: `vocabulary.spec.ts` "popup loads without console errors".
- FAIL: `capture.spec.ts:101` "saves a word straight from the page with the floating toolbar" — toast text `save: serendipity` ≠ expected `Saved "serendipity"`.
- Root cause for "popup features don't work": `get-selection` has no background handler → popup never receives the page selection.

## Quality gates (run after every task)
- `npm run typecheck` → 0 errors
- `npm run lint` → clean
- `npm test` → 397 passing (unchanged) + new unit tests pass
- `npm run test:e2e` → all pass (must include new popup get-selection + toast tests)
- `npm run build` (app + content) → both bundle

---

## Task 1: Wire `get-selection` background handler
**Objective:** The popup can load the active page selection.

**Files:** Modify `src/background/handlers.ts` (createHandlers map).
**Step 1:** Add to the handler map:
```ts
'get-selection': () => readActiveSelection(),
```
(`readActiveSelection` is already exported from this module.)
**Step 2:** `npm run typecheck` → pass.
**Step 3:** `npm test` → pass.
**Step 4:** Commit `fix(voc): register get-selection background handler so the popup can read the page selection`.

## Task 2: Unify toast wording
**Objective:** One consistent toast vocabulary across content script and background.

**Files:** Modify `src/content/index.ts` (line ~166 and ~214), `src/background/index.ts` (line ~69) if needed.
**Step 1:** Replace `` `${action}: ${text.slice(0,24)}…` `` with a clear phrase, e.g. for the save action `Saved "${text}"` (matching the popup). Keep `Copied to clipboard`, `Translated`, `Nothing to translate`, AI error messages as-is.
**Step 2:** Ensure `save-selection`/`save-current-selection` backgrounds emit `Saved "word"` (already do) — no change needed there.
**Step 3:** `npm test` + `npm run lint` → pass.
**Step 4:** Commit `fix(voc): consistent save/toast wording across surfaces`.

## Task 3: Popup e2e coverage (prove "all features work")
**Objective:** Add tests that prove the popup loads the selection and translate functions.

**Files:** Add `e2e/popup.spec.ts` (or extend `vocabulary.spec.ts`).
**Step 1:** Test: load sample page, select text, open popup (extensionId + `/src/popup/index.html`), assert `TranslatePanel` shows a Translate button and the saved-word form is prefilled with the selection word (proves `get-selection` works end-to-end).
**Step 2:** Add a translate smoke: inject a fake/override provider via settings so `translate` returns a stubbed string, click Translate, assert the translated text appears (proves the popup→background→provider→popup path works without a real API key).
**Step 3:** Add a toast assertion: trigger a toolbar save on the page, assert the toast text matches `Saved "…"` (proves Task 2).
**Step 4:** `npm run test:e2e` → all pass.
**Step 5:** Commit `test(voc): popup selection + translate e2e coverage`.

---

## Risks / tradeoffs
- Do NOT change message/protocol types — pure handler wiring + string fixes.
- `readActiveSelection` returns `null` when no tab/selection; the popup already handles null (renders SaveForm without context). Safe.
- The translate e2e must not require a real API key — use a settings override / fake provider so it's hermetic.
- Keep this work separate from the in-flight VOC-59…64 polish run; run after it finishes.

## Definition of Done
- `get-selection` handler registered; popup loads the page selection; `TranslatePanel` renders and translates (with configured/fake provider).
- Toast wording consistent (`Saved "word"` / `Saved N words`).
- New e2e passes; full gate green (typecheck + lint + 397 unit + e2e + dual build).
