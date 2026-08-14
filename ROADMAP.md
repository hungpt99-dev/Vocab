# Roadmap

Delivery is tracked in Linear under the **Vocab** project (team `VOC`).

## Shipped — v0.1.0

| Milestone | Scope | Status |
| --- | --- | --- |
| **M1 Foundation** | Vite + React + TS scaffold, Tailwind, ESLint, Vitest, MV3 manifest and build | ✅ Done |
| **M2 Capture & Storage** | Dexie schema, repositories, message bus, context menu, shortcut, popup save | ✅ Done |
| **M3 Library & Highlighting** | Search/filter/edit/delete/favourite/tag, DOM highlighter, hover card | ✅ Done |
| **M4 AI & Settings** | Provider abstraction, six providers, explanation rendering, options, import/export | ✅ Done |
| **M5 Hardening & Release** | Playwright E2E, accessibility pass, documentation, production build | ✅ Done |

## Next — v0.2.0 (candidate)

Ordered by expected value.

1. **Reading mode** — a distraction-free, bilingual view of any article. Entry + five instantly
   switchable layouts shipped; translation engine, streaming and per-site controls follow.
2. **Spaced-repetition review mode** — a daily queue over saved words using an SM-2-style schedule.
   The largest gap between "saving words" and "learning words".
3. **Pronunciation audio** — play IPA via the Web Speech API; no extra API key needed.
4. **Bulk operations** — multi-select in the library for tagging, favouriting and deleting.
5. **Streaming explanations** — render tokens as they arrive to reduce perceived latency.
6. **Per-site highlight control** — allow-list and block-list of domains.
7. **CSV / Anki export** — alongside the existing JSON backup.

## Considered and deliberately deferred

* **Cloud sync** — conflicts with the local-first, no-backend premise (ADR-001). JSON export covers
  device migration.
* **Firefox port** — feasible (MV3 is broadly shared) but needs a separate manifest and its own E2E
  matrix; revisit once the feature set stabilises.
* **Bundled API key / proxy** — would require a backend and shift cost and liability onto the project.
