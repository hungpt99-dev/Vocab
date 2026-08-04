# VOC-70 Processing feedback + unify explain surface + bilingual dashboard icon — Plan

> **For Hermes:** Plan → Linear VOC-70 → implement directly (CodingAutomation worker 503-blocked).

## Background (verified)
- Page toolbar (`avs-toolbar`): Explain button calls `runExplain` (index.ts:200) which opens a floating `ExplainPanel` on the page. Translate button was removed in VOC-69.
- Popup (`src/popup/App.tsx`): has `SaveForm` + `TranslatePanel` + `LibraryList` (each saved word has an "AI explain" button → `handleExplain` → shows result inline in EntryCard via `ExplanationView`).
- So there are **TWO explain surfaces**: the floating page `ExplainPanel` and the popup's explain. User wants them as ONE.
- Loading states: EntryCard shows `<Spinner>` while explaining (good). But the **page toolbar Explain shows NO loading state** during the AI await (toolbar just hides). Popup TranslatePanel disables button but no spinner.
- Popup header has a Settings button but **no bilingual toggle/icon**.

## Quality gates (every task)
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (app+content), `npm run test:e2e`. Icons lucide only.

## Task 1: Loading effect while processing
**Files:** `src/content/index.ts` (`runExplain`), `src/content/toolbar.ts` / `toolbar-actions.ts` (disable+spinner on AI actions), `src/features/capture/TranslatePanel.tsx` (spinner while translating).
- Page toolbar Explain: while awaiting the AI, show a spinner state on the button (disable + SpinnerIcon) instead of just hiding.
- Popup TranslatePanel: show a clear spinner/processing state while translating (it already disables; add visible spinner).
- Use existing `Spinner`/`SpinnerIcon` (lucide) — no new icons.

## Task 2: Unify explain into ONE surface (the popup)
**Files:** `src/content/index.ts` (`runExplain`), `src/popup/App.tsx`, `src/storage/settings-repository.ts` (or a small `pending-explain` store), `src/shared/messaging/contract.ts`.
- Clicking **Explain on the page toolbar** opens the **popup** (`chrome.action.openPopup()`) and passes the word+context (via a short-lived `pendingExplain` in chrome.storage.local). The popup, on mount, if `pendingExplain` exists, runs `handleExplain`-style flow and shows the explanation in the popup (one surface). The floating `ExplainPanel` is no longer the explain surface for toolbar actions.
- The popup's own "AI explain" per-entry button already exists → stays. So both entry points end in the popup.
- Keep `ExplainPanel` class available (used elsewhere? check) but toolbar no longer opens it for explain; or remove its usage from toolbar. If `ExplainPanel` is only used by `runExplain`, drop that path.

## Task 3: Bilingual icon on the dashboard
**Files:** `src/popup/App.tsx` (header), reuse `Settings`/`useSettings`.
- Add a **bilingual mode toggle icon** (lucide `Languages`) in the popup header, next to Settings. Reflects `settings.bilingualMode`; clicking toggles it (persists). Active state styled (e.g. brand color when on).
- Mirrors the Options "Bilingual mode" section, giving a one-tap dashboard control.

## Task 4: Tests
- Unit: toolbar action shows spinner state while processing (mock); popup bilingual toggle flips `bilingualMode`.
- E2e: page-toolbar Explain opens popup with the word's explanation (or at least opens popup + pending explain persisted); bilingual toggle in popup header flips setting and persists.

## Risks
- `chrome.action.openPopup()` requires a user gesture (the click provides it) — fine.
- Pending-explain must be consumed once (cleared after use) to avoid re-explaining on every popup open.
- Don't break VOC-66/67/68/69 behavior.
- Keep `ExplainPanel` import removed only if unused elsewhere.

## Definition of Done
- AI actions show a processing spinner/disabled state (page toolbar + popup translate).
- Page-toolbar Explain consolidates into the popup explain surface (one explain flow).
- Popup header has a lucide bilingual toggle reflecting `bilingualMode`.
- All gates green; new unit + e2e pass; lucide icons only.
