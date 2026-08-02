# Testing

What is tested, at which level, and why. Related: [Development](DEVELOPMENT.md),
[Contributing](CONTRIBUTING.md),
[ADR-010](DECISION_LOG.md#adr-010--e2e-fixtures-served-over-http).

---

## Current state

| Level | Count | Tool |
| --- | --- | --- |
| Unit and component | **187 tests** across 23 files | Vitest + jsdom + Testing Library + fake-indexeddb |
| End-to-end | **14 tests** across 3 specs | Playwright against a real Chromium with the unpacked extension |

All green as of v0.1.0.

---

## Strategy

The distribution is deliberately bottom-heavy, but with a thicker E2E layer than a typical web app.
The reason is specific to extensions: **the most dangerous bugs in this project are invisible to unit
tests**, because they live in the boundary between the extension and Chrome.

Three real examples, all caught by E2E and none catchable by unit tests:

| Bug | Why unit tests missed it |
| --- | --- |
| Content script emitted as ESM, so highlighting silently never ran | Unit tests import modules directly; they never exercise Chrome's injection |
| Settings checkbox reverted mid-interaction | Required a real async round trip and a real render |
| Setting changes not reaching open tabs when the worker was evicted | Required real service-worker lifecycle |

So: pure logic is unit-tested exhaustively because it is cheap, and anything crossing a Chrome API
boundary gets an E2E test because nothing else will find the bug.

### What belongs where

| Level | Use for | Do not use for |
| --- | --- | --- |
| **Unit** | Pure functions, matcher, parsing, repositories, adapters with mocked `fetch`, DOM utilities | Anything needing real Chrome APIs |
| **Component** | React behaviour queried by role and accessible name | Implementation details, class names, internal state |
| **E2E** | Capture, highlighting, cross-surface sync, persistence, settings, accessibility, responsiveness | Logic already covered by a unit test — E2E is slow |

---

## Commands

```bash
npm run test            # all unit and component tests
npm run test:watch      # watch mode while developing
npm run test:coverage   # coverage report
npm run test:e2e        # builds, then runs Playwright under xvfb

npx vitest run src/ai                  # one directory
npx vitest run src/content/matcher.test.ts   # one file
npx playwright test capture            # one E2E spec
npx playwright test --debug            # step through an E2E test
```

`test:e2e` runs `npm run build` first, deliberately: Playwright loads `dist/`, so testing a stale
build is a real and confusing failure mode.

---

## Unit and component tests

Co-located with the code as `*.test.ts` / `*.test.tsx`.

**Environment.** jsdom, configured in `vitest.config.ts`, with `src/test/setup.ts` as the setup file.

**Chrome API mock.** `src/test/chrome-mock.ts` provides a minimal fake of the `chrome` namespace —
`storage.local`, `runtime.sendMessage`, `tabs` — so modules that touch Chrome APIs can be unit-tested.
It is a mock, not an emulator: it verifies *our* logic, never Chrome's behaviour. Anything depending on
real Chrome semantics belongs in E2E.

**IndexedDB.** `fake-indexeddb` gives repositories a real IndexedDB implementation in Node, so
repository tests exercise genuine queries and index behaviour rather than a stub.

**Component tests** query the way a user perceives the UI:

```tsx
// Good — survives refactoring, asserts what the user can do
await userEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
expect(screen.getByLabelText('Highlight colour')).toHaveValue('#ff0000');

// Bad — couples the test to markup
expect(container.querySelector('.btn-primary')).toBeTruthy();
```

**The design-token guard.** `src/shared/styles/tokens.test.ts` asserts that Tailwind's palette is the
shared token object and that every hex literal in the injected stylesheet is a known token. Hardcoding
a colour fails the suite. See [Design system](DESIGN_SYSTEM.md).

---

## End-to-end tests

`e2e/`, run by Playwright against a persistent Chromium context with the unpacked extension loaded.

| Spec | Covers |
| --- | --- |
| `vocabulary.spec.ts` | Save, search, favourite, edit, delete, highlighting, hover card, settings persistence, live highlight toggle, JSON export |
| `capture.spec.ts` | Context-menu registration, selection capture through the worker, on-page toast |
| `accessibility.spec.ts` | 320 px responsive popup, keyboard-only save, accessible names, labelled regions, focusable highlights, `Escape` dismissal |

### Fixtures

`e2e/fixtures.ts` supplies four:

| Fixture | Provides |
| --- | --- |
| `context` | Persistent Chromium context with `--load-extension` |
| `serviceWorker` | The extension's service worker, for driving worker-side code |
| `extensionId` | Extension id, needed to build `chrome-extension://` URLs |
| `samplePageUrl` | A throwaway local HTTP server serving a fixture page |

### Two constraints that will bite you

**1. Extensions cannot run headless.** Chromium must run headed, so E2E needs a display. On Linux
`npm run test:e2e` wraps Playwright in `xvfb-run -a`. Running `npx playwright test` directly on a
headless machine fails.

**2. Content scripts are not injected into `data:` URLs.** The first highlighting test found zero
highlights while the feature worked manually, purely because the fixture was a `data:` URL. Fixtures
are therefore served over real HTTP from an ephemeral port. See
[ADR-010](DECISION_LOG.md#adr-010--e2e-fixtures-served-over-http).

### Rules

- **No arbitrary `waitForTimeout`.** Use web-first assertions — they retry, and they document intent:

  ```ts
  // Good
  await expect(page.locator('mark.avs-highlight').first()).toBeVisible({ timeout: 10_000 });
  // Bad — flaky by construction
  await page.waitForTimeout(3000);
  ```

- Query by role and accessible name, so the test doubles as an accessibility check.
- Assert **zero console errors** on surfaces where that is a requirement (NFR-3).
- Keep specs independent; each gets a fresh context.

---

## Coverage goals

Coverage is a diagnostic, not a target to game. The rules that actually matter:

| Area | Expectation |
| --- | --- |
| Repositories, adapters, parsing, matcher | Every branch, including failure paths |
| Error handling | Every `AiError` code has a test |
| React components | Every user-reachable interaction |
| Chrome API boundaries | Covered by E2E, not chased in unit coverage |
| Generated or trivial code | Not chased |

A high percentage over untested error paths is worse than a lower one with every failure mode
covered. Run `npm run test:coverage` to find genuinely untested logic.

---

## Test data

- **Inline and explicit.** Build the entry a test needs in the test; no shared mutable fixture file.
- **Realistic.** `serendipity` and a real sentence, not `foo` and `bar` — realistic data exposes
  normalisation and word-boundary bugs.
- **Never a real credential.** Use obvious placeholders such as `sk-test-key`.
- **Isolated.** Each unit test gets a fresh `fake-indexeddb`; each E2E test a fresh browser context.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`, in two jobs:

| Job | Steps |
| --- | --- |
| `quality` | `npm ci` → typecheck → lint → unit tests → build → upload `dist/` |
| `e2e` | `npm ci` → install Playwright Chromium with deps → `npm run test:e2e` → upload the report |

They run in parallel; both must pass. Concurrency is configured so a new push cancels the superseded
run on the same branch.

The Playwright HTML report is uploaded even on failure, which is usually the fastest way to diagnose a
failing E2E run.

---

## Writing a test for a bug fix

1. Write a test that reproduces the bug. **Watch it fail** — a test that passes before the fix proves
   nothing.
2. Choose the level that would have caught it. If a unit test would not have, write an E2E test.
3. Fix the cause, not the symptom.
4. Watch it pass.
5. Keep the test. Name it after the behaviour, not the bug number.
