## Summary

Removes the character-glyph fallback system from the React icon set. Icons are now rendered exclusively as Lucide's inline SVGs, with the existing `label`-driven aria handling preserved.

## Changes

- `src/shared/ui/Icons.tsx`: deleted the `GLYPHS` char map, the `useFontHealthy()` SVG font-health probe, the `Fallback` component, and the `build(Glyph, fallbackGlyph)` fallback wiring. `build(Glyph)` now wraps each Lucide component directly; `aria-hidden` stays off when a `label` is supplied and on for decorative SVGs. All 15 exports keep their names and `LucideProps & { label?: string }` signatures.
- `docs/DESIGN_SYSTEM.md`: removed the now-inaccurate "Resilience note" describing the font probe and char fallback; stated that icons render as Lucide inline SVGs with no glyph fallback.

## Testing

- `npm run typecheck` — passes.
- `npx eslint src/shared/ui/Icons.tsx` — no issues.
- `npm test -- --run src/shared/ui/ui.test.tsx` — 15/15 pass.
- No call sites changed; all icon usages (StarIcon, PencilIcon, TrashIcon, XIcon, SearchIcon, SettingsIcon, PlusIcon, FilterIcon, AlertIcon, CheckIcon, BookIcon, SparklesIcon, DownloadIcon, UploadIcon) keep working unchanged.

## Risks

None known. This is a pure removal of the defensive fallback; in normal browsers Lucide icons already rendered and behaviour is unchanged. The `useFontHealthy` effect and DOM probe were also removed, which eliminates a one-time document mutation.
