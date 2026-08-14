# Project Overview

## Vision

Reading is where most vocabulary is encountered and where most of it is lost. A reader meets an
unfamiliar word, guesses from context, moves on, and forgets it. Vocab aims to make
capturing a word cost roughly nothing — one keystroke, in place, without leaving the page — and then
to keep that word visible in the reader's ordinary browsing until it becomes familiar.

The product is a **personal notebook that happens to be intelligent**, not a language-learning
platform. It should feel like a browser feature rather than a service.

## Goals

| Goal | What it means concretely |
| --- | --- |
| Capture must be instant | Three routes (context menu, shortcut, popup) so the fastest one is always at hand. Saving never navigates away or interrupts reading. |
| Context is preserved | A word without its sentence is nearly useless later. Every entry stores the surrounding sentence, source URL and page title automatically. |
| Learning is passive | Saved words are highlighted wherever the user browses. Recall is driven by ordinary reading rather than a separate study session. |
| The user owns the data | Everything is local and exportable as plain JSON. No lock-in, no account. |
| AI is optional and unbundled | Explanations are useful but not required. The user brings their own key and picks their own provider, including local models. |

## Non-goals

Stating these explicitly matters more than the goals, because they are what keep the product small.

| Non-goal | Why |
| --- | --- |
| Cloud sync | Requires accounts, hosting, conflict resolution and a privacy policy. Export/import covers device migration, which is the actual need behind most sync requests. See [ADR-001](DECISION_LOG.md#adr-001--local-first-with-no-backend). |
| User accounts or authentication | There is no server to authenticate against. Identity adds friction and risk with no corresponding benefit. |
| A bundled or proxied API key | Would require a backend, shift running costs onto the project, and make the project liable for users' usage. |
| Being a full SRS / flashcard app | Anki and its ecosystem do this well. A lightweight review mode is on the roadmap; competing with Anki is not. |
| Translation | Dictionaries and translators already exist and are one click away. The value here is *your* words in *your* reading context. |
| Telemetry or analytics | Incompatible with the privacy posture. Product decisions are made from issues and user reports. |

## User problems

1. **"I look up the same word repeatedly."** Nothing records the lookup, so each encounter starts over.
2. **"I saved a word but forgot what it meant in that context."** A bare word list loses the sentence
   that made the word meaningful.
3. **"My vocabulary list is somewhere I never open."** A notes app or spreadsheet requires deliberate
   review; it competes with reading instead of supporting it.
4. **"Language tools want my data or my money."** Existing extensions commonly require an account,
   a subscription, or send browsing data to a server.
5. **"I already pay for an AI API."** Users with an OpenAI or Anthropic key — or a local Ollama model —
   should not pay a second subscription for a thin wrapper around it.

## Target audience

- **Language learners** reading real material (articles, documentation, fiction) in a second language.
- **Native speakers expanding vocabulary** — readers of dense non-fiction, students, writers.
- **Professionals learning a domain** where the barrier is terminology rather than language.
- **Privacy-conscious and technical users** who prefer local storage and their own API key, including
  those running local models through Ollama or LM Studio.

All four share one trait: they read in the browser and do not want a separate app.

## Product philosophy

**Local-first is a feature, not a limitation.** No backend means no outage, no subscription, no data
breach affecting users, and no privacy policy to negotiate. The constraint it imposes — no sync — is
answered honestly with export/import rather than papered over.

**The reading flow is sacred.** Any interaction that pulls the user out of the page has failed. This
is why capture is a keystroke, feedback is a transient toast, and explanations are pull-based rather
than automatic by default.

**Bring your own key is an alignment choice.** The user's costs are visible to them and controlled by
them. The project never sits between a user and their provider, and never sees their traffic.

**Absent features are cheaper than wrong features.** Every non-goal above is a decision not to build
something plausible. The product stays comprehensible because of what it refuses.

## Key principles

1. **Nothing leaves the browser** except calls the user explicitly triggers, sent directly to the
   provider they chose. See [Security](SECURITY.md).
2. **The user can always get their data out**, in a documented, versioned, human-readable format.
3. **No provider is privileged.** The AI layer is an abstraction with interchangeable adapters; a
   local model is a first-class option. See [AI providers](AI_PROVIDER.md).
4. **Failure is visible and specific.** Errors are normalised into stable codes and surfaced in plain
   language, never swallowed.
5. **Accessibility is a requirement, not a pass.** Every control is keyboard reachable and carries an
   accessible name; highlights are focusable and their tooltips dismissible.
6. **Documentation is part of the product.** A change that alters behaviour without updating docs is
   incomplete. See [AI agent rules](AI_AGENT_RULES.md).

## Where to go next

| If you want to | Read |
| --- | --- |
| Understand what the product must do | [Product requirements](PRODUCT_REQUIREMENTS.md) |
| Understand how it is built | [Architecture](ARCHITECTURE.md), then [System design](SYSTEM_DESIGN.md) |
| Understand why it is built that way | [Decision log](DECISION_LOG.md) |
| Start contributing | [Development](DEVELOPMENT.md), then [Contributing](CONTRIBUTING.md) |
| Work on this as an AI agent | [AI agent rules](AI_AGENT_RULES.md) and [AI workflow](AI_WORKFLOW.md) |
