# AI Workflow

The loop an autonomous agent runs when working on this repository. The rules that govern *how* each
step is performed are in [AI agent rules](AI_AGENT_RULES.md); this document is the sequence.

The loop is deliberately strict. Its purpose is to make an agent's work verifiable by someone who was
not watching.

---

## The loop

```
      ┌────────────────────────────────────────────────────┐
      │                                                    │
      ▼                                                    │
 1. Read docs ──► 2. Understand ──► 3. Plan ──► 4. Linear  │
                     architecture                          │
                                                           │
 5. Implement ──► 6. Test ──► 7. Lint ──► 8. Typecheck      │
                                                           │
 9. Run tests ──► 10. Review ──► 11. Update docs            │
                                                           │
 12. Commit ──► 13. Changelog ──► 14. Next task ────────────┘
```

Never skip documentation. Never skip tests. Never skip review.

---

## 1. Read the documentation

Before touching code, read what is relevant to the task:

| Task type | Read first |
| --- | --- |
| Any task | [Project overview](PROJECT_OVERVIEW.md), [Architecture](ARCHITECTURE.md), [AI agent rules](AI_AGENT_RULES.md) |
| Storage or schema | [Storage](STORAGE.md), [ADR-002](DECISION_LOG.md#adr-002--dexie-behind-a-repository) |
| AI or providers | [AI providers](AI_PROVIDER.md), ADRs [003](DECISION_LOG.md#adr-003--one-adapter-for-openai-compatible-providers)–[005](DECISION_LOG.md#adr-005--tolerant-parsing-of-ai-responses) |
| Content script | [System design](SYSTEM_DESIGN.md), ADRs [006](DECISION_LOG.md#adr-006--the-content-script-is-built-separately-as-an-iife)–[008](DECISION_LOG.md#adr-008--one-compiled-regex-for-matching) |
| UI or styling | [Design system](DESIGN_SYSTEM.md), [Coding standards](CODING_STANDARDS.md) |
| Anything user-facing | [Product requirements](PRODUCT_REQUIREMENTS.md) |

Check the [Decision log](DECISION_LOG.md) for an ADR that already settles your question. Re-litigating
a decision wastes the work that produced it.

## 2. Understand the architecture

Read the actual code you are about to change and its neighbours. Confirm:

- Which layer and which of the four MV3 surfaces you are working in
- Which dependency rules apply (see [Folder structure](FOLDER_STRUCTURE.md))
- What tests already cover this area
- Whether the behaviour you are adding already exists somewhere

**If documentation and code disagree, the code is the truth.** Note the discrepancy — you will fix the
document at step 11.

## 3. Create an implementation plan

State, before writing code:

- The files you will add or change
- The tests you will write and what each proves
- Which documents the change will make inaccurate
- The risks, and what could break

If the plan cannot end in a single green build, the task is too large — go to step 4 and decompose it.

## 4. Create or update Linear issues

The board must reflect reality before work starts.

- Decomposed the task? Create the child issues **now**, with acceptance criteria.
- Found a bug outside your scope? File it rather than fixing it inline.
- Move the issue you are about to start into **In Progress**.

Issues carry: a clear title, acceptance criteria, priority, dependencies, and the
[Definition of Done](AI_AGENT_RULES.md#11-definition-of-done).

## 5. Implement one feature

One issue at a time. Resist adjacent improvements — file them instead.

For a bug fix, write the failing test **first**. A fix without a reproduction is unverified.

## 6. Write tests

Choose the level deliberately:

| Level | Use for |
| --- | --- |
| Unit | Pure logic, repositories, adapters, parsing, DOM utilities |
| Component | React behaviour, queried by role and accessible name |
| E2E | Anything requiring real Chrome APIs across surfaces |

See [Testing](TESTING.md). Tests assert behaviour, never implementation.

## 7–9. Run the gates

In this order — each is faster than the next, so failing early saves time:

```bash
npm run lint        # style and correctness rules
npm run typecheck   # tsc --noEmit
npm run test        # unit and component tests
npm run test:e2e    # builds, then Playwright against a real Chromium
npm run build       # production build must succeed
```

**Read the output.** A gate you did not run is a gate that failed.

## 10. Fix failures, then review

Fix the cause, not the symptom. Do not weaken a test or disable a rule to get to green — see
[forbidden practices](AI_AGENT_RULES.md#14-forbidden-practices).

Then self-review your own diff against the
[review checklist](AI_AGENT_RULES.md#13-self-review-before-every-commit): bugs, duplication,
complexity, security, performance, dead code, naming, tests, docs.

Refactor now if the review calls for it — in a separate commit.

## 11. Update documentation

Work through this table. Answering "no" to all of them is a valid outcome, but you must check.

| Did you change… | Then update |
| --- | --- |
| A layer, boundary or surface | [Architecture](ARCHITECTURE.md) |
| An algorithm, sequence or lifecycle behaviour | [System design](SYSTEM_DESIGN.md) |
| A directory's purpose or dependency rules | [Folder structure](FOLDER_STRUCTURE.md) |
| The Dexie schema, indexes or the export format | [Storage](STORAGE.md) |
| The provider interface, or added a provider | [AI providers](AI_PROVIDER.md) |
| The message contract | [API guidelines](API_GUIDELINES.md) |
| A manifest permission or data handling | [Security](SECURITY.md) |
| The test strategy, tooling or commands | [Testing](TESTING.md) |
| A design token or theming rule | [Design system](DESIGN_SYSTEM.md) |
| A convention other code must follow | [Coding standards](CODING_STANDARDS.md) |
| An npm script or setup step | [Development](DEVELOPMENT.md), [README](../README.md) |
| Anything user-facing | [README](../README.md), [Product requirements](PRODUCT_REQUIREMENTS.md) |
| Something knowingly left incomplete | [Known limitations](KNOWN_LIMITATIONS.md) |
| A significant, contestable decision | A new ADR in the [Decision log](DECISION_LOG.md) |

**Documentation updates ship in the same commit as the code.** A follow-up commit that never comes is
how documentation rots.

## 12. Commit

Conventional Commits. Subject says what; body says **why**.

```
fix(content): apply setting changes when the service worker is asleep

An MV3 worker is evicted after ~30s idle, so the settings-changed broadcast
never fired if the user changed a preference while it was down. Content
scripts now observe chrome.storage.onChanged directly.

Caught by an E2E test, not by unit tests. Recorded as ADR-007.
```

Never commit with a failing gate. Never commit a secret, generated output, or commented-out code.

## 13. Update the changelog

For any user-visible change, add an entry to [CHANGELOG.md](CHANGELOG.md) under *Unreleased*, in the
right category (Added / Changed / Fixed / Removed). Write it for a user, not a developer.

Internal refactors with no user-visible effect do not need an entry.

## 14. Move to the next task

- Move the Linear issue to **Done** with a comment recording what was verified — the gates you ran and
  the evidence.
- Pick the next highest-priority issue.
- Return to step 1.

**Continue automatically.** Do not stop after one issue and wait to be asked. Stop only when the
backlog is empty, or a genuine blocker requires a human decision.

---

## Continuous documentation

After **every** change, ask the step 11 questions. The intent is that documentation can never silently
drift, because drift is caught at the moment it is introduced rather than in a periodic audit that
never happens.

Concretely, this means:

- A behaviour change with stale docs is **not done**, regardless of test status.
- A discrepancy you notice in passing gets fixed, even if unrelated to your task. This is the one
  exception to "do not touch unrelated code" — accuracy costs one line and compounds.
- Every pull request must leave the documentation more accurate than it found it.

---

## Reporting

When reporting completed work, state:

1. What changed, and why
2. The gate results **as actually observed** — real numbers, real output
3. Bugs found along the way, including ones you did not cause
4. Documents updated
5. Anything deliberately left undone, and why

Never report a result you did not observe. If something could not be run, say so and explain what
blocked it. An honest blocker is more useful than a confident fabrication, and far easier to recover
from.
