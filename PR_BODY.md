## Summary

Implements the Bilingual Reading Mode epic (VOC-42): any article can be turned into a
paragraph-aligned bilingual reading experience. Translation flows through the existing provider
abstraction — the content script never touches an AI provider directly — with lazy loading, caching
and five layout modes.

## Changes

- **AI layer**
  - `src/ai/types.ts`: added `TranslateRequest` / `TranslateResult` and a `translate()` capability to `AiProvider`.
  - `src/ai/prompts/translate.prompt.ts`: shared system + user prompts for structured paragraph translation.
  - `src/ai/parse-translation.ts`: tolerant parser for `{"translations":[...]}` responses; count mismatch is a hard error so columns cannot misalign.
  - `src/ai/providers/*`: implemented `translate()` on the shared OpenAI-compatible adapter, Gemini and Anthropic.
  - `src/ai/translate-service.ts`: single entry point — chunked (8 paragraphs/request), cached, rate-limited, retried, fallback-aware.
  - `src/ai/run-with-fallback.ts` + shared rate limiter: de-duplicated the retry-once-fallback logic previously private to `ExplainService`.
- **Messaging / background**
  - `src/shared/messaging/contract.ts`: new `translate-article` and `toggle-bilingual-reading` messages.
  - `src/background/handlers.ts`: `translate-article` handler wired through `TranslateService`.
  - `src/background/index.ts` + `scripts/manifest.ts`: `Alt+Shift+R` command toggles the reader in the active tab.
- **Content script**
  - `src/content/reading/extract.ts`: extracts shallowest text-bearing blocks (preserving heading structure), skipping boilerplate/scripts/hidden regions.
  - `src/content/reading/reader.ts`: the reader overlay — five layouts, font size, vocabulary highlight, lazy chunk loading via `IntersectionObserver`, per-section retry, `Translate all`, focus-managed accessible dialog.
  - `src/content/reading/preferences.ts` / `styles.ts`: persisted reading preferences (`avs:reading`) and injected reader stylesheet.
  - `src/content/index.ts`: reader singleton wired to the toolbar "Translate" action, the toggle command and vocabulary refreshes; reader nodes excluded from the mutation observer.
- **Tests**: parse-translation, translate-service (chunking, caching, credentials), provider translate cases, article extraction, preferences, reader (render, layouts, error/retry, Escape), and a background handler case. 247 tests passing.
- **Docs**: CHANGELOG entries added.

## Testing

- `npm run typecheck` — passes
- `npm run lint` — passes
- `npx vitest run` — 247 tests pass (30 files)
- `npm run build` — app + content script build successfully (content.js 29.75 kB)

## Risks

- Extraction is heuristic: pages whose article text is wrapped in unusual containers may produce
  fewer/different blocks than expected; the reader reports "no article content" and opens nothing in
  that case rather than mangling the page.
- Translation quality and latency depend on the configured provider; long articles translate in
  chunks as you scroll, and failures show a per-section retry. Translations are cached only for the
  page session.
- The toggle/hover layouts rely on CSS display toggling inside our own overlay only — the host page
  is never restyled. No follow-ups known.
