## Summary

Wires the floating selection toolbar's **Save to Vocabulary** action (VOC-48) into the existing save
flow. Saving from a selection now persists the word/phrase together with its surrounding context
sentence, source URL, source title and detected source language — reusing `saveSelection` /
`VocabularyRepository.save`, with the AI explanation + translation still attached when the
auto-explain setting is enabled.

## Changes

- `src/content/selection.ts`: extracted `buildSelectionPayload(word, contextNode)` so a capture
  payload can be built from an explicit selection even after the live selection is cleared; added
  detected `sourceLanguage` via `detectLanguage`.
- `src/content/toolbar.ts`: `ToolbarState` now carries the full `SelectionPayload`; the
  `avs-toolbar-action` event dispatches `{ action, payload }` instead of `{ action, text }`.
- `src/content/index.ts`: the toolbar `save` action sends the new `save-selection` message and shows
  a success/error toast; `copy` now reads the payload's word.
- `src/background/handlers.ts`: `saveSelection` passes `sourceLanguage` to the repository; added the
  `save-selection` message handler (reuses `saveSelection`, broadcasts `vocabulary-changed`).
- `src/background/index.ts`: the context-menu / shortcut capture path also forwards the detected
  `sourceLanguage`.
- `src/popup/App.tsx`: the popup SaveForm path records `sourceLanguage` too.
- `src/shared/messaging/contract.ts`: `SelectionPayload` gains `sourceLanguage`; new
  `save-selection` message + response type.
- Tests updated/added: selection language detection, toolbar payload emission, `save-selection`
  handler, and persisted `sourceLanguage`.
- `CHANGELOG.md` and `README.md` updated to reflect the new save path.

## Testing

- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npx vitest run` — 25 files, 218 tests passing
- `npm run build` — app + content IIFE build succeed

## Risks

- The surrounding sentence is read from the selection's nearest block container at toolbar-show
  time; selections spanning elements without a shared text parent may fall back to the raw selection
  text as context (existing behavior, unchanged).
- `explain` / `translate` / `more` toolbar actions remain placeholders (VOC-44..47); only `save` is
  wired here.
