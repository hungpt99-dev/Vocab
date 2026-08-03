# VOC Explain/Translate buttons: fix cryptic toast + visual — Implementation Plan

> **For Hermes:** Plan → Linear issue → auto-code via CodingAutomation (drive-voc.sh). Linear is source of truth.

**Goal:** The popup's `Translate selection` + `AI explain` buttons (and the content-script toolbar's Explain/Translate actions) must (a) look correct, and (b) actually work — showing the result in the UI, and when no AI provider is configured, show a **clear, actionable** message instead of a cryptic/empty toast.

## Root cause (verified)
- `src/ai/explain-service.ts:45` throws `AiError('unknown_provider', 'No active AI provider is configured.')` when no provider is set.
- Popup `handleExplain` (`src/popup/App.tsx:85`) and `TranslatePanel.tsx` catch and `notify(error.message)`. When the thrown value is not an `Error` (or message is blank), they fall back to generic text — and the toast can read as "no info".
- The **content-script** Explain/Translate popover (`src/content/explain-popover.ts`, `toolbar-actions.ts`) renders a custom-DOM popover. The VOC-61 "design tokens" PR restyled these overlays; the result popover may look broken ("weird") and on error may surface an empty toast.
- With no provider, the feature cannot return a result, so the user only ever sees a toast — perceived as "not work".

## Quality gates (every task)
- `npm run typecheck` → 0 errors
- `npm run lint` → clean
- `npm test` → 397 passing + new tests
- `npm run test:e2e` → pass; add a fake-provider e2e proving the result renders in popup + toolbar, and a no-provider e2e proving a clear actionable toast.
- `npm run build` (app + content) → both bundle.

## Task 1: Clear, actionable feedback when no provider
**Files:** `src/popup/App.tsx`, `src/features/capture/TranslatePanel.tsx`, `src/content/toolbar-actions.ts` (or `explain-popover.ts`).
**Step 1:** Centralize the "no provider" message: e.g. `No AI provider configured — add one in Settings.` and include a way to open Settings (`chrome.runtime.openOptionsPage()`).
**Step 2:** Ensure the catch always has a non-empty, human message (never the generic fallback when a real `AiError` exists). Preserve the `AiError.code` if useful.
**Step 3:** Tests: assert the toast text is the clear message (not empty/generic).
**Step 4:** Commit.

## Task 2: Result actually renders (not just a toast)
**Files:** `src/features/capture/TranslatePanel.tsx` (shows inline — confirm it does), `src/content/explain-popover.ts` (render explanation/translation in the popover, not a toast).
**Step 1:** Verify `TranslatePanel` renders `translation` below the button; if it currently toasts instead, change to inline render.
**Step 2:** Verify the toolbar Explain/Translate popover shows the explanation/translation body; on error show the message *inside* the popover, not a blank toast.
**Step 3:** e2e with a stubbed/fake provider (settings override) proving the rendered result is visible.
**Step 4:** Commit.

## Task 3: Fix "looks weird" (overlay styling)
**Files:** `src/content/explain-popover.ts`, `src/content/translate` (if exists), `src/content/styles.ts` (overlay tokens from VOC-61).
**Step 1:** Audit the explain/translate popover markup + tokens for broken layout (overflow, unstyled buttons, misaligned icon/text, z-index).
**Step 2:** Align button/heading styling with the rest of the overlays (toolbar, hover-card) using the existing token set; ensure icons come from `lucide-static` (no char/self-made).
**Step 3:** Visual e2e screenshot or DOM assertions for the popover.
**Step 4:** Commit.

## Risks
- Don't weaken provider error handling — keep `AiError` info, just surface it clearly.
- Keep `get-selection` + TranslatePanel working (don't regress VOC-65).
- Toolbar popover is custom DOM (no Tailwind) — style with the overlay token helpers, not React classes.

## Definition of Done
- Explain/Translate show the result in the UI (popup inline + toolbar popover).
- No-provider state shows one clear, actionable toast linking to Settings (never empty/cryptic).
- Overlay styling consistent and not "weird".
- All gates green; new e2e proves both paths.
