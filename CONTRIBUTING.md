# Contributing

Thanks for helping improve AI Vocabulary Saver.

## Getting started

```bash
npm install
npm run build      # produces dist/
```

Load `dist/` at `chrome://extensions` with **Developer mode** → **Load unpacked**.
Run `npm run dev` for a watch build; press the reload icon on the extension card to pick up changes
(popup and options changes just need the surface reopened).

## Requirements

* Node 20 or newer
* A display for E2E tests (`xvfb-run` on Linux; `npm run test:e2e` handles this)

## Quality gates

Everything below must pass before a change is committed:

```bash
npm run typecheck   # tsc --noEmit, strict mode
npm run lint        # eslint, zero warnings
npm run test        # vitest unit tests
npm run test:e2e    # playwright against the built extension
npm run build       # production build must succeed
```

## Code standards

**Structure.** Feature-based folders. Cross-cutting code goes in `shared/`. Nothing in `shared/` may
import from `features/`. Only `storage/` may import Dexie.

**TypeScript.** Strict mode, no `any` (the lint rule is an error), no non-null assertions in
production code. Export domain types from `shared/types`.

**Components.** Keep them presentational where possible — data fetching belongs in hooks. Every
interactive element needs an accessible name; icon-only buttons must use `IconButton`, which requires
a `label`.

**Comments.** Explain *why*, not *what*. Document non-obvious constraints (MV3 quirks, browser
behaviour) at the point where they bite.

**No duplication.** If you are about to copy a block, extract it. New AI providers that speak the
OpenAI dialect should be added as a preset in `OPENAI_COMPATIBLE_PRESETS`, not as a new class.

## Testing

* Test behaviour, not implementation. Query by role and accessible name.
* Repository and adapter logic needs unit tests with mocked `fetch` / `fake-indexeddb`.
* Anything touching real Chrome APIs (highlighting, capture, persistence) needs an E2E test.
* No arbitrary `waitForTimeout` in E2E — use web-first assertions.

## Adding an AI provider

1. If it speaks the OpenAI chat-completions dialect, add an entry to `OPENAI_COMPATIBLE_PRESETS`
   and add its id to `AI_PROVIDER_IDS`. Done.
2. Otherwise create `src/ai/providers/<name>.ts` implementing `AiProvider`, register it in
   `registry.ts`, and add adapter tests with a mocked `fetch`.

`registry.test.ts` asserts that every declared provider id resolves, so a missing registration fails
the suite.

## Commits

Use Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`) and describe the
*why* in the body. Self-review your diff for bugs, duplication, dead code, security and naming before
committing. Update `CHANGELOG.md` for user-visible changes.
