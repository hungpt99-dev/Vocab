## Summary

Adds the entry point and layout switcher for Reading Mode (VOC-49): a full-page bilingual overlay of
the current article, opened from the selection toolbar's "More" menu, with five layouts that switch
instantly. Translations are fetched through the provider abstraction, so the content script never
couples to any specific AI provider.

## Changes

- **`src/content/reading-mode.ts`** (new) — `extractReadableContent` (title + bounded top-level
  blocks, skipping nav/code) and a `ReadingMode` overlay. Layouts: `side-by-side`, `original-first`,
  `translation-first`, `hover-translation` (keyboard-focusable originals), `toggle-translation`.
  Switching is pure CSS state on the blocks container — no rebuild, no reload.
- **`src/content/toolbar.ts`** — the "More" button now opens an accessible dropdown menu (role
  `menu`/`menuitem`, `aria-expanded`) with a **Reading mode** entry; emits the existing
  `avs-toolbar-action` event.
- **`src/content/index.ts`** — handles the `reading-mode` action (toast when no article content) and
  ignores reading-mode nodes in the mutation observer.
- **`src/ai/translate-service.ts`** (new) + **`src/ai/prompts/translate.prompt.ts`** (new) — app-level
  translation entry point reusing the rate limiter, retry/backoff and fallback behaviour; per-block
  failures degrade to `null` rather than failing the article.
- **`src/ai/types.ts` + the three provider adapters** — `AiProvider` gains `translate()`, with the
  shared chat-completions/Messages/generateContent transport factored into one private `complete()`
  per adapter (no duplicated logic between `explain` and `translate`).
- **`src/ai/rate-limiter.ts` / `src/ai/explain-service.ts`** — a single shared `aiRateLimiter` so
  explanations and translations share one budget.
- **`src/shared/messaging/contract.ts` + `src/background/handlers.ts`** — new `translate-blocks`
  message routed through `TranslateService`.
- **`src/content/styles.ts` + `src/shared/styles/tokens.ts`** — token-based reading-mode and toolbar
  menu styles; new `reading*` color/typography aliases and `layout.readingMaxWidth`.
- **Tests** — provider `translate`, `TranslateService`, background `translate-blocks` handler,
  toolbar More-menu, and reading-mode extraction/layout/switching.
- **Docs** — CHANGELOG, README features, PRODUCT_REQUIREMENTS (FR-6.x), ROADMAP, DESIGN_SYSTEM and
  ARCHITECTURE updated.

## Testing

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test` — 27 files, 240 tests passing (was 187).
- `npm run build` — app + content bundles build; `dist/content.js` and `dist/background.js` contain
  the reading-mode and translate wiring.
- Manual: opened the toolbar More menu on a selection, entered reading mode, switched all five
  layouts instantly, toggled translations, closed via the header button and Escape.

## Risks

- Reading-mode extraction is a heuristic (article element, else largest text container); pages with
  unusual structures may show imperfect content. Bounded to 12 blocks to keep translation cheap.
- Translation throughput is limited by the shared AI rate limiter (5 req/10s), so a full article can
  take a while to translate; per-block progress is shown.
- The `translate()` addition extends the `AiProvider` interface — any future provider adapter must
  implement it.
