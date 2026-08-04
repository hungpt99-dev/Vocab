# VOC-71 Bilingual switch + headbar + working toggle + rich hover card — Plan

> **For Hermes:** Plan → Linear VOC-71 → implement directly (CodingAutomation worker 503-blocked).

## Background (verified)
- Popup header (src/popup/App.tsx:185) bilingual toggle is an icon **button**, not a switch.
- Toggling `bilingualMode` in settings DOES reach the content script (chrome.storage.onChanged -> refresh()), but refresh() only re-applies highlights. It never starts inline bilingual reading or shows a headbar -> toggle feels "not working".
- Hover card (src/content/hover-card.ts:122 renderContent) shows only word/pronunciation/meaning/note/saved -> NOT the full Explanation. HighlightEntry.explanation (Explanation, src/shared/types/vocabulary.ts:2) has meaning, simpleExplanation, translation, examples, synonyms, antonyms, relatedWords, pronunciation, collocations, grammar, partOfSpeech, usage, summary, difficultVocabulary, register, etymology, relatedPhrases, provider, model, generatedAt.

## Quality gates (every task)
typecheck + lint + dual build + unit + e2e; lucide icons only.

## Task 1: Bilingual toggle as a SWITCH + loading while turning on
- Add a shared React `Switch` component (src/shared/ui/Switch.tsx) — lucide-style track/thumb, controlled, `loading` prop shows a spinner while activating.
- In popup header, replace the icon button with the `Switch` (keep LanguagesIcon as a label/indicator). While turning ON, show spinner (the content script may take a moment to activate inline reading). Use `useSettings().update` + a transient `activating` state.

## Task 2: Headbar when bilingual mode is ON
- Content script: a small top **headbar** (.avs-bilingual-bar) shown when bilingualMode is true. Shows e.g. "Bilingual · <targetLanguage>" + a lucide close (X) to turn it off. Fixed top, high z-index, token-styled.
- Inject/remove on settings change (refresh path) and on page load when mode on.

## Task 3: Make the toggle actually work
- In content script refresh()/settings-watch: when bilingualMode true -> ensure inline bilingual reading is active for the current page (show headbar + start inline reader injection); when false -> tear down injected translations + headbar.
- Reuse InlineReader.open()/close() (VOC-69). On settings change while a page is open, call reader.toggle() accordingly (open if on, close if off). Keep behavior consistent with the toolbar "reading mode" action (which still calls reader.toggle()).

## Task 4: Hover card shows FULL AI-enriched data
- hover-card.ts renderContent: if entry.explanation is present, render the full Explanation (meaning, simple, pronunciation, partOfSpeech, grammar, examples, synonyms, antonyms, collocations, register, etymology, relatedPhrases). Mirror ExplanationView.tsx sections but in vanilla DOM (hover card is vanilla, not React). Keep the "AI explain" button (re-runs explain). If no explanation, keep the "No explanation yet" stub + AI explain button.

## Task 5: Tests
- Unit: Switch renders + loading; hover-card renders full explanation sections (mock entry with explanation).
- E2e: popup bilingual switch toggles + persists; turning on shows headbar on page (.avs-bilingual-bar visible) and inline translations appear (with provider) — without provider, headbar still shows and toggle reflects state; hover card shows enriched data after explain.

## Risks
- Inline reader injection on every page when mode on could be heavy; guard: only run on pages that actually have article content (extractArticle returns blocks). If no blocks, just show headbar (mode on) without injection.
- `chrome.storage.onChanged` fires for the popup's own change too; ensure idempotent (open when on, close when off).
- Don't break VOC-69 inline reading toolbar action.
- Keep explanation rendering safe for missing fields.

## Definition of Done
- Popup bilingual control is a Switch with loading state.
- Toggling ON activates bilingual on the page (headbar + inline translations); OFF tears down.
- Hover card on highlighted words shows the full AI explanation.
- All gates green; new unit + e2e pass; lucide icons only.
