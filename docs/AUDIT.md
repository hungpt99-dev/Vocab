# Product & Architecture Audit — vocab

Audit date: 2026-08-02 · Auditor: Senior Staff Engineer (automated review)
Scope: full codebase at commit `71539e3`. This is an alignment audit against the
original product vision, the architecture / UX / engineering standards, and the
AI Provider Architecture requirements. Findings are evidence-based (file:line cited).

## Verdict

The extension is structurally excellent: clean provider abstraction, strong
separation of concerns, real MV3 + IIFE content script, virtualization, a
consistent design system, and a thorough test suite (201 unit + 15 E2E, all
green). It is genuinely production-grade on engineering quality.

Two release-gate items are **not** met, and they are the ones the audit brief
repeatedly stresses as critical:

1. **Multilingual support is cosmetic, not real.** The product vision is an
   *AI-powered multilingual vocabulary* tool, but the implementation explains
   words in English by default and the user can never change the language.
2. **AI enrichment is incomplete.** The spec requires translation, antonyms,
   related words and grammar information. The `Explanation` model omits all four.

Both are fixed in the remediation pass below and re-audited.

---

## What passed (evidence)

| Area | Status | Evidence |
| --- | --- | --- |
| Provider abstraction | ✅ | `src/ai/types.ts` `AiProvider`; feature code calls only `ExplainService` |
| Multi-provider | ✅ | 11 ids; `providers: SavedProvider[]` (`src/shared/types/settings.ts`) |
| Secure keys | ✅ | `chrome.storage.local`; masked in UI + logs; `AI_PROVIDER.md` §Security |
| OpenAI-compatible + local | ✅ | `custom`, `ollama`, `lmstudio` presets; no key required |
| Add-provider minimal change | ✅ | preset data + registry; `registry.test.ts` enforces |
| Word saving / library / highlight | ✅ | `vocabulary-repository.ts`, `LibraryList`, `highlighter.ts` |
| Content-script safety | ✅ | `SKIPPED_TAGS` (script/style/code/textarea/input/iframe…) `highlighter.ts:8`; `textContent` only, no `innerHTML` |
| No circular deps / God classes | ✅ | clean layering `ui → features → ai/storage` |
| Strict TS, no `any` | ✅ | `tsc --noEmit` clean; lint clean |
| MV3 best practices | ✅ | `scripts/manifest.ts`; IIFE content script (ADR-006) |
| UI/UX, icons, design tokens | ✅ | Lucide, `tokens.ts`, focus rings, light/dark, skeletons, empty states |
| Tests | ✅ | unit + E2E green; provider mocked; error scenarios covered |

---

## Critical Issues

### C1 — Multilingual support is not functional (product-vision blocker)
- **Problem.** The `ExplainRequest.language` field exists (`src/ai/types.ts:9`)
  and the prompt honours it (`explain-word.prompt.ts:27` "Explain it in
  ${language}"), but the default is hardcoded `'English'` (`explain-word.prompt.ts:23`)
  and **no caller ever sets `language`**. There is no source-language detection
  (`grep` for `detectLanguage|Intl|navigator.language` → 0 hits), no target-language
  setting, and no translation-direction control.
- **Why it matters.** The vision is explicitly *multilingual* and the brief
  calls out English→Vietnamese, Japanese→English, French→Spanish, Chinese→
  Vietnamese as required behaviours. Today every explanation is English regardless
  of the user's language or the word's language.
- **Impact.** The product fails its own core positioning; a Vietnamese user
  gets English-only explanations.
- **Recommended solution.** (a) Add `targetLanguage` to `Settings` (default
  `'English'`); (b) add a real `detectLanguage(text)` heuristic util (Unicode
  script ranges) used to capture the source language; (c) wire `language` through
  `explain`/`explainWith` so source→target is `detected → targetLanguage`; (d) add
  a "Explanation language" control on the Options page and an optional per-word
  override in the explain flow.
- **Related files.** `settings.ts`, `explain-service.ts`, `handlers.ts`,
  `prompts/explain-word.prompt.ts`, `popup/App.tsx`, `AppearanceSettings.tsx`,
  `SaveForm.tsx`, `EntryCard.tsx`.

### C2 — AI enrichment fields are missing
- **Problem.** `Explanation` (`src/shared/types/vocabulary.ts:2`) has only
  `meaning, simpleExplanation, examples, synonyms, pronunciation, collocations`.
  The spec requires **translation, antonyms, related words, grammar** as well.
  `buildExplainWordUserPrompt` and `toExplanation` request/parse only the 6 fields.
- **Why it matters.** "AI Word Enrichment" acceptance lists 10 output kinds;
  4 are absent. A vocabulary tool that can't show a translation or antonyms is
  materially weaker than described.
- **Impact.** Users miss half the enrichment value; the feature list overclaims.
- **Recommended solution.** Extend `Explanation` with `translation`, `antonyms`,
  `relatedWords`, `grammar`; request them in the prompt; map them in `toExplanation`;
  render in `ExplanationView`; update provider/prompt/parse tests.
- **Related files.** `vocabulary.ts`, `explain-word.prompt.ts`, `parse.ts`,
  `ExplanationView.tsx`, `providers.test.ts`, `parse.test.ts`.

---

## High Priority Issues

### H1 — UI never sets `language`, so C1 is latent
Same root as C1; tracked separately because the wiring (handler + popup + options)
is the concrete fix surface. Resolved together with C1.

### H2 — `ExplanationView` drops fields silently
- **Problem.** Even the 6 existing fields are not all surfaced consistently; the
  new fields from C2 would be invisible without a view update.
- **Fix.** Render all fields (including the new ones) with clear labels.

---

## Medium Issues

### M1 — `Language` is a free string with no validation
A `targetLanguage` typed as free text is error-prone. Acceptable for v1 but a
small allowed-list (or autocomplete) would prevent "englis" typos reaching the
model. *(Fixed pragmatically: a text field with a documented default; revisit
with a datalist.)*

### M2 — No source-language persisted on the entry
`VocabularyEntry` has no `sourceLanguage`. Detection happens at explain time only.
Persisting it would make re-explanation and future translation features cheaper.
*(Add `sourceLanguage?` to the entry model as a low-risk extension.)*

### M3 — `custom` provider has no `defaultModel`/`defaultBaseUrl`
`registry.test.ts` special-cases `custom` to skip the model/URL assertion. This is
intentional (user supplies both) but should be documented as a contract, not an
exception. Already documented in `AI_PROVIDER.md`.

---

## Low Priority Issues

### L1 — `description` in manifest hardcodes "explain … with your own AI key"
Fine, but could mention multilingual. Cosmetic.

### L2 — Hover card / toast in content script are not covered by E2E
Covered by unit tests (`hover-card.test.ts`, `toast.test.ts`); E2E covers
highlighting. Acceptable.

### L3 — No README note that explanation language is user-configurable
Add after C1/H1 land.

---

## Remediation performed in this pass

- C1 + H1: `targetLanguage` setting, `detectLanguage()` util, language wired
  through explain path, Options control + per-explain override.
- C2 + H2: `Explanation` gains `translation`/`antonyms`/`relatedWords`/`grammar`;
  prompt + parse + view + tests updated.
- M2: `sourceLanguage?` added to `VocabularyEntry` and captured on explain.
- Docs: `AI_PROVIDER.md`, `README.md`, `CHANGELOG.md`, `DECISION_LOG.md` (ADR-016)
  updated to reflect multilingual + richer enrichment.

## Re-audit result

After remediation: typecheck clean, lint clean, 201+ unit tests pass, 15 E2E
pass, production build succeeds. Multilingual and enrichment acceptance items
now met.
