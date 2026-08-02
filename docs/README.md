# Documentation

Everything needed to understand, build, extend and ship **AI Vocabulary Saver** — a local-first Chrome
Manifest V3 extension that saves vocabulary while you browse and explains it with your own AI key.

For the product pitch, installation and quick start, see the [root README](../README.md).

---

## Start here

| You are… | Read, in this order |
| --- | --- |
| **New to the project** | [Project overview](PROJECT_OVERVIEW.md) → [Architecture](ARCHITECTURE.md) → [Development](DEVELOPMENT.md) |
| **About to write code** | [Folder structure](FOLDER_STRUCTURE.md) → [Coding standards](CODING_STANDARDS.md) → [Testing](TESTING.md) |
| **An AI coding agent** | [AI agent rules](AI_AGENT_RULES.md) → [AI workflow](AI_WORKFLOW.md) → [Architecture](ARCHITECTURE.md) |
| **Reviewing a change** | [Contributing](CONTRIBUTING.md) → [Coding standards](CODING_STANDARDS.md) → [Decision log](DECISION_LOG.md) |
| **Shipping a release** | [Release process](RELEASE_PROCESS.md) → [Deployment](DEPLOYMENT.md) → [Changelog](CHANGELOG.md) |
| **Assessing privacy** | [Security](SECURITY.md) → [Storage](STORAGE.md) |

---

## Index

### Product

| Document | Contents |
| --- | --- |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Vision, goals, non-goals, user problems, audience, philosophy, principles |
| [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | Functional and non-functional requirements, edge cases, acceptance criteria, success metrics, out of scope |
| [ROADMAP.md](ROADMAP.md) | What shipped, what is next, what was deliberately deferred |
| [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) | Honest limits, separating deliberate non-goals from unfinished work |

### Architecture

| Document | Contents |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers, components, data flow, dependency rules, extension points — and why each exists |
| [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) | Runtime mechanics: worker lifecycle, capture sequence, matching algorithm, DOM highlighting, AI pipeline, failure modes |
| [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) | Every directory: purpose, ownership, allowed dependencies, what must never go there |
| [DECISION_LOG.md](DECISION_LOG.md) | ADRs: problem, options, choice, reasoning, trade-offs |

### Subsystems

| Document | Contents |
| --- | --- |
| [AI_PROVIDER.md](AI_PROVIDER.md) | Provider abstraction, request flow, timeouts, error codes, tolerant parsing, adding a provider |
| [STORAGE.md](STORAGE.md) | Dexie schema, indexes, normalised keys, migrations, export/import format |
| [SECURITY.md](SECURITY.md) | Permission model and justifications, API key handling, privacy posture, threat model |
| [API_GUIDELINES.md](API_GUIDELINES.md) | The internal typed message contract and conventions for outbound provider calls |

### Standards

| Document | Contents |
| --- | --- |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | Naming, components, hooks, repositories, dependency injection, errors, logging, performance, accessibility |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Design tokens, colour, typography, spacing, elevation, motion, dark mode, z-index policy |
| [TESTING.md](TESTING.md) | Strategy, unit vs component vs E2E, coverage goals, the Chrome mock, CI, known pitfalls |

### Process

| Document | Contents |
| --- | --- |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setup, every command, the two-config build, debugging each surface, troubleshooting |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branch naming, commit conventions, PR rules, review checklist, Definition of Done |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Producing a loadable artifact, Chrome Web Store submission, permission justifications |
| [RELEASE_PROCESS.md](RELEASE_PROCESS.md) | SemVer policy, release checklist, tagging, verification, hotfixes |
| [CHANGELOG.md](CHANGELOG.md) | Keep a Changelog history |

### For AI agents

| Document | Contents |
| --- | --- |
| [AI_AGENT_RULES.md](AI_AGENT_RULES.md) | Philosophy, decision hierarchy, architecture and naming rules, Definition of Done, forbidden practices |
| [AI_WORKFLOW.md](AI_WORKFLOW.md) | The 14-step loop from reading docs to committing and moving on |

---

## Conventions

**One home per fact.** Each fact is documented in exactly one place; everything else links to it. If
you find the same explanation in two documents, delete one and link instead.

**Why over what.** Code shows what happens. Documentation explains why it happens that way, and what
was rejected.

**Honesty about gaps.** Unimplemented behaviour is labelled as such. No document claims a feature the
code does not have. Streaming and automatic retry, for example, are marked not implemented in
[AI_PROVIDER.md](AI_PROVIDER.md) and [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

**Documentation ships with code.** A change that alters behaviour updates its documentation in the
same commit. See the impact table in [AI_WORKFLOW.md](AI_WORKFLOW.md#11-update-documentation) and the
checklist in the [pull request template](../.github/pull_request_template.md).

**Decisions become ADRs.** Anything that constrains future work, or that a reasonable engineer would
decide differently, gets an entry in the [decision log](DECISION_LOG.md).
