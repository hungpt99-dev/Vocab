# Roadmap

Tracked in Linear (project **AI Vocabulary Saver**, team VOC). This document is the human-readable
summary; the issue tracker is authoritative.

---

## Shipped — v0.1.0

| Area | Status |
| --- | --- |
| Capture (context menu, keyboard shortcut, popup) | ✅ |
| Vocabulary library (search, edit, delete, favourite, tag) | ✅ |
| On-page highlighting with accessible hover card | ✅ |
| AI Explain across eleven providers | ✅ |
| Settings: provider, key, colour, export/import | ✅ |
| Storage: Dexie with unique-key de-duplication | ✅ |
| Tests: 503 unit + 18 E2E, all green | ✅ |
| Documentation: full `docs/` suite | ✅ |
| CI: typecheck, lint, unit, build, E2E | ✅ |

---

## Next — candidate backlog (prioritised)

| Priority | Item | Why |
| --- | --- | --- |
| 1 | **Reading mode** (entry + layouts shipped) | Bilingual reading is a core learning path; translation engine and per-site controls follow |
| 2 | **Spaced-repetition review mode** | The product is a learning tool; passive recall is the missing half |
| 3 | **Pronunciation audio** | Speak the IPA the model returns; low effort, high learning value |
| 4 | **Bulk library operations** (multi-select delete/tag/export) | One-at-a-time editing does not scale to a real vocabulary |
| 5 | **Streaming AI explanations** | Cut perceived latency; the interface is already partial-shaped |
| 6 | **Per-site highlight lists** | Let cautious users restrict where the script runs |
| 7 | **CSV / Anki export** | Interoperability with other study tools |
| 8 | **Offline / cached explanations on first save** | Reduce cost for words saved in volume |
| 9 | **Tag autocomplete and tag colours** | Faster organisation of a growing library |

Priority is a judgement, not a commitment. Items are pulled into a milestone when someone starts them.

---

## Considered and deliberately deferred

These requests are real but intentionally out of scope. Each is recorded so it is not re-litigated.

| Item | Why deferred | Revisit if |
| --- | --- | --- |
| **Cloud sync** | Contradicts the local-first premise; adds hosting, accounts, and a data-breach surface. Export/import covers portability. | Users repeatedly ask for cross-device sync *and* accept E2E encryption |
| **Project-supplied API key / free tier** | Misaligns incentives and creates a billing liability. Bring-your-own-key is the premise. | The premise changes |
| **Firefox support** | Needs a manifest conversion and a separate E2E matrix; Chromium is the target. | Demand justifies the maintenance cost |
| **Safari support** | Different extension model entirely. | A contributor owns it |
| **Automatic retry on AI failure** | Replaying auth/format errors wastes the user's quota. The safe subset (rate-limit, 5xx, network) is small and unimplemented pending backoff design. | A backoff design exists that is cancellable and quota-safe |
| **Social / sharing features** | Not a personal notebook's job. | — |
| **Gamification / streaks** | Adds pressure without serving recall. | — |

---

## Non-goals (permanent)

From [Project overview](PROJECT_OVERVIEW.md#non-goals):

- No backend, no accounts, no authentication.
- No telemetry, no analytics, no crash reporting.
- No third-party scripts or CDNs.
- No storage of browsing history beyond the source URL of a saved word.

---

## How a roadmap item becomes work

1. An issue is created in Linear with acceptance criteria and a priority.
2. It is linked to the relevant epic and milestone.
3. Work follows the [AI workflow](AI_WORKFLOW.md): read docs, implement, test, document, commit,
   update changelog, close.
4. Shipped work is noted here under "Shipped" and, for user-visible changes, in the
   [Changelog](CHANGELOG.md).

The roadmap is a living document. Update it when scope is added or removed, not just at release time.
