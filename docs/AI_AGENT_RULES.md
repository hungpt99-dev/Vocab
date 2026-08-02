# AI Agent Rules

Operating rules for autonomous AI coding agents working in this repository. Humans should read them
too — they are the project's standards, stated so a machine can follow them without guessing.

For the step-by-step loop an agent runs, see [AI workflow](AI_WORKFLOW.md).

---

## 1. Project philosophy

Internalise these before writing code. They decide most arguments.

1. **Local-first is a feature.** No backend, no accounts, no telemetry. A proposal requiring a server
   is out of scope regardless of merit. See [Project overview](PROJECT_OVERVIEW.md#non-goals).
2. **The reading flow is sacred.** Nothing may interrupt or navigate away from the user's page.
3. **No provider is privileged.** Application logic must never branch on which AI provider is active.
4. **Absent features are cheaper than wrong features.** Declining to build is a valid outcome.
5. **Fail visibly and specifically.** Never swallow an error; never show "something went wrong".
6. **Documentation is part of the product.** A behaviour change with stale docs is unfinished work.

---

## 2. Decision hierarchy

When sources conflict, follow this order. Do not silently resolve a conflict at a lower level.

| Rank | Authority |
| --- | --- |
| 1 | An explicit instruction from the user in the current task |
| 2 | Security and privacy constraints ([Security](SECURITY.md)) |
| 3 | Accepted ADRs ([Decision log](DECISION_LOG.md)) |
| 4 | This document and [Coding standards](CODING_STANDARDS.md) |
| 5 | Existing patterns in neighbouring code |
| 6 | General best practice |

**If you must contradict an accepted ADR, do not just do it.** Write a new ADR that supersedes the old
one, stating what changed. If you cannot justify it, the ADR wins.

**If a documented fact contradicts the code, the code is the truth** — then fix the documentation in
the same change, because one of them is a bug.

---

## 3. Architecture rules

- Respect layer direction: presentation → application → domain → infrastructure. Never upward.
- **Only `src/storage` may import Dexie.** No exceptions.
- **Only `src/ai/providers` may know a provider's wire format.**
- **`src/shared` must never import from `src/features`.**
- The content script must never hold the API key or call a provider. It runs in untrusted pages.
- Cross-surface communication goes through the typed contract in `src/shared/messaging/contract.ts`.
  Never invent an ad-hoc message shape.
- Business logic belongs in pure, dependency-injected functions (see `src/background/handlers.ts`),
  not in Chrome event listeners, so it can be tested without a browser.
- Cross-surface state that must propagate should be observed from `chrome.storage`, not relayed by
  the service worker — the worker may be asleep
  ([ADR-007](DECISION_LOG.md#adr-007--the-content-script-observes-storage-directly)).

---

## 4. Coding standards

Full detail in [Coding standards](CODING_STANDARDS.md). The rules an agent most often breaks:

- **No `any`.** `@typescript-eslint/no-explicit-any` is an error. Use `unknown` and narrow.
- **No non-null assertions (`!`) in production code.** Handle the absent case.
- **No `console.log`.** Only `warn` and `error` are permitted.
- Use the `@/` path alias, not deep relative chains.
- Comments explain **why**, not what. Document non-obvious platform constraints where they bite.
- Delete dead code rather than commenting it out; version control is the archive.

---

## 5. Folder and naming rules

| Thing | Convention | Example |
| --- | --- | --- |
| React component file | `PascalCase.tsx` | `EntryCard.tsx` |
| Module / utility file | `kebab-case.ts` | `explain-service.ts` |
| Hook | `useThing.ts`, must start with `use` | `useVocabulary.ts` |
| Test | co-located `*.test.ts(x)` | `matcher.test.ts` |
| E2E spec | `e2e/*.spec.ts` | `capture.spec.ts` |
| Type / interface | `PascalCase`, no `I` prefix | `VocabularyEntry` |
| Constant | `SCREAMING_SNAKE_CASE` | `DEFAULT_HIGHLIGHT_COLOR` |

New code goes in the feature folder it serves. Promote to `src/shared/` only on the **second**
consumer, not in anticipation of one.

Never place: business logic in `src/shared/ui`, Chrome API calls in `src/features`, or anything
feature-specific in `src/shared`.

---

## 6. Theme rules

**Never hardcode a design value.** No hex colours, no pixel radii, no shadows, no font stacks outside
`src/shared/styles/tokens.ts`.

To add a visual value: add a token, then consume it. Tailwind reads the same tokens as the content
script's injected CSS, so both stay consistent.

This is enforced, not advisory: `src/shared/styles/tokens.test.ts` fails if a hex literal appears in
the injected stylesheet that is not a known token. See
[Design system](DESIGN_SYSTEM.md) and
[ADR-012](DECISION_LOG.md#adr-012--a-single-design-token-module-for-two-styling-paths).

---

## 7. Testing requirements

Full strategy in [Testing](TESTING.md).

- Every behaviour change ships with a test. No exceptions for "trivial" changes.
- Test **behaviour, not implementation**. Query by role and accessible name; never assert on internal
  state or class names.
- Pure logic, repositories and adapters: unit tests.
- Anything touching real Chrome APIs — highlighting, capture, persistence across surfaces: E2E.
- **No arbitrary `waitForTimeout` in E2E.** Use web-first assertions; they retry.
- A bug fix starts with a test that reproduces the bug and fails.
- If a test is hard to write, treat that as a design signal, not a reason to skip it.

---

## 8. Security requirements

Full detail in [Security](SECURITY.md).

- **Never log, echo or commit an API key.** Not in `console.warn`, not in an error message, not in a
  test fixture.
- Never add a permission to `scripts/manifest.ts` without justifying it in
  [Security](SECURITY.md). Reviewers and store review will ask.
- Never use `innerHTML` with page-derived or model-derived content. Build nodes and set `textContent`.
- Never send user data anywhere except the provider the user configured.
- Never introduce a dependency that phones home.
- Treat page content and model output as untrusted input.

---

## 9. Performance requirements

- Content script work must stay off the critical path: batch mutations, schedule on idle.
- Never introduce a per-word pass over the DOM; matching is one compiled regex
  ([ADR-008](DECISION_LOG.md#adr-008--one-compiled-regex-for-matching)).
- Keep the packaged artifact small; question any dependency that adds significant weight.
- The popup must be interactive quickly — do no blocking work at import time.
- Debounce user-driven queries (search is already debounced).

---

## 10. Accessibility requirements

- Every interactive element has an accessible name. Icon-only buttons use `IconButton`, which requires
  a `label`.
- Everything reachable and operable by keyboard; focus must be visible.
- Overlays: correct roles (`tooltip`, `alertdialog`, `status`), and dismissible with `Escape`.
- Respect `prefers-reduced-motion` — the injected stylesheet already does.
- The popup must remain usable at 320 px with no horizontal overflow (asserted by E2E).
- Do not rely on colour alone to convey state.

---

## 11. Definition of Done

An issue is not done until **every** box is true:

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run test` passes
- [ ] `npm run test:e2e` passes
- [ ] `npm run build` succeeds
- [ ] New behaviour is covered by tests; a fixed bug has a regression test
- [ ] No `TODO`, `FIXME` or commented-out code left behind
- [ ] Accessibility checked (keyboard, accessible names, focus)
- [ ] No console errors on any surface
- [ ] No hardcoded design values
- [ ] No duplicated logic introduced
- [ ] Affected documentation updated in the **same** change
- [ ] `docs/CHANGELOG.md` updated for user-visible changes
- [ ] Self-review performed (§13)
- [ ] Linear issue moved to Done with a comment describing what was verified

---

## 12. Refactoring guidelines

- Refactor in a **separate commit** from behaviour change. A diff that does both is unreviewable.
- Tests must pass before and after, unchanged. If tests must change, it is not a refactor.
- Refactor when: the same logic appears a third time, a function exceeds one clear responsibility, a
  name no longer matches behaviour, or a test is hard to write.
- Do **not** refactor: code you merely find unfamiliar, or code unrelated to your task. Opportunistic
  rewrites inflate diffs and hide regressions.
- Duplication is only worth removing once the shape is known. Two similar blocks may be a coincidence;
  three are a pattern.

---

## 13. Self-review before every commit

Re-read your own diff and look for:

| Category | Ask |
| --- | --- |
| Bugs | Off-by-one, unhandled rejection, missing `await`, wrong equality |
| Duplication | Does this logic already exist elsewhere? |
| Complexity | Can this be simpler? Is any abstraction speculative? |
| Security | Any key, any `innerHTML`, any new permission, any new outbound call? |
| Performance | Any loop over the DOM, any unbatched work, any blocking import? |
| Dead code | Unused exports, leftover debug output, commented blocks |
| Naming | Does each name still describe what the thing does? |
| Tests | Do they test behaviour, and would they fail if the code were wrong? |
| Docs | Which documents does this change make inaccurate? |

---

## 14. Forbidden practices

Absolute. Do not do these, and do not ask whether an exception applies.

| Forbidden | Why |
| --- | --- |
| Committing or logging an API key or token | Irreversible disclosure |
| Adding a backend, account system or telemetry | Contradicts the product premise |
| `any`, `@ts-ignore`, `@ts-expect-error` to silence a real type error | Hides the defect |
| Disabling a lint rule inline to make a commit pass | Fix the code, or change the rule deliberately with a reason |
| Weakening or deleting a failing test to make it pass | The test is usually right; investigate first |
| `innerHTML` with page or model content | XSS |
| `waitForTimeout` as a substitute for a proper assertion | Flaky by construction |
| Hardcoding colours, spacing or fonts | Breaks the token system |
| Importing Dexie outside `src/storage` | Breaks the storage boundary |
| Reporting success without running the gates | The single worst failure mode for an autonomous agent |
| Inventing output, file contents or test results | Never fabricate; report the blocker instead |
| `git push --force` to `main` | Destroys history |
| Committing generated output (`dist/`, `*.tsbuildinfo`) | Noise; already gitignored |

---

## 15. Expected behaviour for autonomous agents

**Work in small, complete increments.** One issue at a time, each ending in a green build and a
commit. Do not batch five features into one commit.

**Verify, never assume.** Run the command and read the output. A claim of success unsupported by tool
output is a fabrication.

**When blocked, say so.** If a dependency will not install or a test cannot pass, report the blocker
with evidence and try an alternative. Never substitute plausible-looking invented output.

**Prefer reading to guessing.** The answer is usually in the code. Read the neighbouring module before
inventing a pattern.

**Keep Linear synchronised.** The board must reflect reality at all times. If work is decomposed,
create the new issues before starting them.

**Decompose when too large.** If an issue cannot be finished in one green-build increment, split it in
Linear first.

**Stop and ask** only when a decision is genuinely ambiguous *and* consequential — a scope change, a
new dependency with licence implications, anything touching the security posture. Otherwise choose the
option most consistent with this document and record it.

**Leave the repository better than you found it.** Every change should make the documentation more
accurate, not less.
