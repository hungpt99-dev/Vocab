# Contributing

Thank you for considering a contribution. This project is small and opinionated, and most of its
conventions live in other documents — read those before opening a pull request.

| Document | Read it for |
| --- | --- |
| [Coding standards](CODING_STANDARDS.md) | Naming, imports, components, error handling, security rules |
| [Testing](TESTING.md) | What must be tested and at what level |
| [Folder structure](FOLDER_STRUCTURE.md) | Where a new file belongs |
| [AI agent rules](AI_AGENT_RULES.md) | The full Definition of Done and forbidden practices |
| [Design system](DESIGN_SYSTEM.md) | The no-hardcoded-values rule |
| [AI workflow](AI_WORKFLOW.md) | The loop every change follows |

---

## Getting started

```bash
git clone https://github.com/hungpt99-dev/Vocab.git
cd Vocab
npm install
npm run build
```

Load `dist/` into Chrome (`chrome://extensions` → Developer mode → Load unpacked). See
[Development](DEVELOPMENT.md).

---

## Branch naming

| Prefix | Use | Example |
| --- | --- | --- |
| `feat/` | New functionality | `feat/pronunciation-audio` |
| `fix/` | A bug fix | `fix/highlight-mutation-loop` |
| `docs/` | Documentation only | `docs/release-process` |
| `refactor/` | Restructuring, no behaviour change | `refactor/storage-repository` |
| `test/` | Adding or fixing tests | `test/capture-e2e` |
| `chore/` | Build, tooling, deps | `chore/bump-vite` |

Branch from `main`. Keep a branch scoped to one change.

---

## Commit conventions

Conventional Commits:

```
<type>(<scope>): <subject>

<body — why, not what>

<footer: Refs/Issues>
```

| Type | Meaning |
| --- | --- |
| `feat` | New user-facing functionality |
| `fix` | A bug fix |
| `docs` | Documentation change |
| `refactor` | Restructure without behaviour change |
| `test` | Test change |
| `chore` | Build, tooling, dependencies |
| `perf` | Performance improvement |

Subject: imperative, lower case, no trailing period, under 72 characters.

Body: explain **why**. Reference an issue with `Refs #VOC-12` or `Closes #VOC-12` when it closes one.

Examples:

```
fix(content): apply setting changes when the service worker is asleep

An MV3 worker is evicted after ~30s idle, so the settings-changed broadcast
never fired if the user changed a preference while it was down. Content
scripts now observe chrome.storage.onChanged directly.

Refs #VOC-31
```

```
feat(settings): add export and import of the vocabulary

Replaces the ad-hoc JSON dump with a versioned, validated backup schema and
merge/replace restore. Closes #VOC-22.
```

---

## Pull request rules

A PR must:

- Reference the issue it addresses.
- Pass every CI job: typecheck, lint (zero warnings), unit tests, build, E2E.
- Include tests for behaviour changes and a regression test for bug fixes.
- Update affected documentation **in the same PR**.
- Report status without fabricating: real gate output, real test numbers.
- Not include generated output (`dist/`, `*.tsbuildinfo`) or secrets.

Use the PR template; fill every section. A PR that leaves the documentation less accurate than it found
it is not ready.

---

## Review checklist

For every PR, verify:

| Area | Check |
| --- | --- |
| Behaviour | Does the PR do what the issue asks? |
| Tests | Is new behaviour covered? Is a fixed bug reproduced by a test that failed first? |
| Typecheck | `npm run typecheck` clean |
| Lint | `npm run lint` zero warnings |
| E2E | `npm run test:e2e` passes if the change touches Chrome APIs |
| Security | No key logged or committed; no new permission without justification; no `innerHTML` with untrusted input; no new outbound host |
| Performance | No per-word DOM pass; no blocking import-time work |
| Accessibility | Accessible names; keyboard operable; focus visible; `prefers-reduced-motion` |
| Design system | No hardcoded colour, spacing or font |
| Architecture | Dependency direction respected; no Dexie outside `storage`; no provider logic outside `ai/providers` |
| Docs | Affected documents updated; new decision recorded as an ADR if contestable |
| Changelog | User-visible change listed under Unreleased |
| Dead code | No `TODO`, no `FIXME`, no commented-out code |

---

## Definition of Done

An issue is Done only when **every** item is true. This is copied verbatim from
[AI agent rules](AI_AGENT_RULES.md#11-definition-of-done) because humans and agents are held to the
same bar:

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
- [ ] Self-review performed
- [ ] Linear issue moved to Done with a comment describing what was verified

---

## Reporting bugs

Open an issue with:

- The version (or commit).
- The affected surface (popup, options, service worker, a specific page).
- Steps to reproduce, ideally with a minimal page.
- What you expected and what happened.
- Console output from the surface — **redact your API key.**

---

## By opening a PR you agree that

Your contribution is licensed under the project's MIT licence (see [../LICENSE](../LICENSE)).
