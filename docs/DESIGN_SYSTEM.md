# Design System

All visual values come from one module. This document explains that module, the two consumers it
serves, and the rule that keeps them consistent.

Source: `src/shared/styles/tokens.ts`. Related:
[ADR-012](DECISION_LOG.md#adr-012--a-single-design-token-module-for-two-styling-paths),
[Coding standards](CODING_STANDARDS.md).

---

## The rule

**Never hardcode a design value.** No hex colours, pixel radii, shadows, font stacks or z-index
literals outside `src/shared/styles/tokens.ts`.

This is enforced, not advisory. `src/shared/styles/tokens.test.ts` fails the suite if a hex literal
appears in the injected stylesheet that is not a known token.

---

## Why a token module exists

The extension styles two environments with incompatible constraints:

| Consumer | Mechanism | Constraint |
| --- | --- | --- |
| Popup and options pages | Tailwind utilities | Normal application styling; Tailwind's preflight is fine |
| Content script overlays | A hand-built CSS string injected into third-party pages | Tailwind is unavailable, and shipping its preflight would restyle the host page |

These two paths cannot be merged — the platform forbids it. So the values they share must be, or they
drift silently and a colour change only lands in half the product.

`tailwind.config.ts` imports the tokens for its palette. `src/content/styles.ts` interpolates the same
tokens into its CSS string. One source, two renderers.

---

## Tokens

### Colour

**Brand ramp** (indigo) — interactive elements, focus rings:

| Token | Value | | Token | Value |
| --- | --- | --- | --- | --- |
| `brand.50` | `#eef2ff` | | `brand.500` | `#6366f1` |
| `brand.100` | `#e0e7ff` | | `brand.600` | `#4f46e5` |
| `brand.200` | `#c7d2fe` | | `brand.700` | `#4338ca` |
| `brand.300` | `#a5b4fc` | | `brand.800` | `#3730a3` |
| `brand.400` | `#818cf8` | | `brand.900` | `#312e81` |

**Slate** — surfaces and text. Only the four shades actually used are defined:
`slate.50` `#f8fafc`, `slate.400` `#94a3b8`, `slate.800` `#1e293b`, `slate.900` `#0f172a`.

**Status** — `status.success` `#15803d`, `status.danger` `#b91c1c`.

**Semantic aliases** — prefer these over raw ramp values, because they carry intent:

| Token | Resolves to | Used for |
| --- | --- | --- |
| `color.focusRing` | `brand.600` | Focus outlines |
| `color.overlaySurface` | `slate.900` | Hover card background |
| `color.overlaySurfaceAlt` | `slate.800` | Toast background |
| `color.overlayText` | `slate.50` | Overlay text |
| `color.overlayMuted` | `slate.400` | Overlay labels |
| `color.readingSurface` | `slate.50` | Reading-mode page background |
| `color.readingHeader` | `brand.50` | Reading-mode header bar |
| `color.readingText` | `slate.900` | Reading-mode article text |
| `color.readingMuted` | `slate.400` | Reading-mode labels and translations |

`DEFAULT_HIGHLIGHT_COLOR` is `#fde68a`. It is a token because it is also the default value of a user
setting — see `DEFAULT_SETTINGS` in `src/storage/settings-repository.ts`.

Overlays use an inverted (dark) surface deliberately: it reads acceptably on both light and dark host
pages, which cannot be predicted. Reading mode is a full-page surface rather than a floating overlay,
so it inverts the usual scheme: a light paper surface with dark text.

### Typography

| Token | Value | Notes |
| --- | --- | --- |
| `typography.systemStack` | `system-ui, -apple-system, 'Segoe UI', sans-serif` | Overlays — must render before any webfont loads |
| `typography.brandStack` | `Inter` then the system stack | Extension pages |
| `typography.overlayBody` | `13px/1.5` | Hover card |
| `typography.overlayCompact` | `13px/1.4` | Toast |
| `typography.overlayLabel` | `11px` | Uppercase labels |
| `typography.readingBody` | `15px/1.6` | Reading-mode paragraphs |
| `typography.readingHeading` | `17px/1.5` | Reading-mode headings and title |

Overlays use the system stack rather than Inter because a font still loading would cause a visible
reflow on someone else's page.

### Spacing, radius, elevation

| Group | Tokens |
| --- | --- |
| `spacing` | `xs` 4px, `sm` 6px, `md` 10px, `lg` 12px, `xl` 16px |
| `radius` | `sm` 3px (highlights), `md` 8px (cards, toasts) |
| `elevation` | `overlay` — `0 8px 24px rgba(15, 23, 42, 0.35)` |

Extension pages use Tailwind's own spacing scale; the `spacing` tokens exist for the injected CSS,
where no scale is available.

### Motion

| Token | Value |
| --- | --- |
| `motion.fast` | `150ms` |
| `motion.easing` | `ease-out` |

Kept short because overlays appear next to the cursor, where any delay reads as lag.

**Reduced motion is honoured.** The toast animation is wrapped in
`@media (prefers-reduced-motion: no-preference)`, so users who ask for less motion get none rather
than a shortened version.

### Z-index

`zIndex.overlay` is `2147483647` — the maximum signed 32-bit integer.

This looks extreme and is deliberate. Overlays are injected into arbitrary pages whose stacking
contexts are unknown; any lower value can be beaten by a host page's sticky header or modal.

### Layout

| Token | Value | Notes |
| --- | --- | --- |
| `layout.popupWidth` | `384px` | Default popup width |
| `layout.popupMinWidth` | `320px` | Narrowest supported; asserted by an E2E test |
| `layout.overlayMaxWidth` | `320px` | Hover card and toast |
| `layout.readingMaxWidth` | `720px` | Comfortable measure for the reading-mode text column |

---

## Dark mode

`darkMode: 'media'` — the OS setting decides. There is no in-app toggle, because a toggle would need a
third state ("follow system") and a preference to store, for little benefit.

Components pair every surface and text colour with a `dark:` variant:

```tsx
className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
```

Injected overlays use a dark surface in both modes, since the host page's own theme is unknown.

---

## Responsive behaviour

Only the popup has meaningful constraints. Chrome sizes the popup to content up to a maximum, so the
design targets a fixed comfortable width with a hard floor at 320 px.

| Breakpoint | Applies to |
| --- | --- |
| 320 px | Popup floor; **no horizontal overflow permitted** (asserted by E2E) |
| 384 px | Default popup width |
| Tailwind `sm:` and up | Options page, which renders in a full tab |

---

## Icons

All product icons come from **`lucide-react`** (consistent stroke, correct sizes, properly
aligned). Emoji, unicode glyphs and ASCII are never used as icons. `src/shared/ui/Icons.tsx`
re-exports the small set the app uses (favorite, edit, delete, search, settings, star,
download/upload, plus dialog/toast/empty-state glyphs).

Why a package rather than hand-rolled inline SVG: the set has grown past a handful of glyphs and
Lucide guarantees a single visual language. The bundle cost is negligible (tree-shaken per icon).
The content-script overlays (toolbar, popovers, panels) run inside third-party pages and render
pure DOM, so they cannot import `lucide-react`. They source the same glyphs from **`lucide-static`**
(raw SVG strings) through the single `icon()` helper in `src/content/icons.ts`, which unwraps the
library's 24x24 SVGs and re-wraps them at the overlays' fixed size without leaking Lucide's class
into the host page.

Icons are rendered as Lucide's inline SVGs directly; there is no char-glyph fallback anywhere.

Every icon-only control uses `IconButton`, which **requires** a `label` prop — the mechanism that
keeps icon buttons from shipping without an accessible name.

## Reusable components

`src/shared/ui/` is the design system. Feature code composes these rather than inventing ad-hoc
markup:

- `Button`, `IconButton` — actions; consistent variants, sizes, focus ring.
- `TextField`, `Select`, `TagInput` — form controls with labels, hints, inline errors.
- `Badge` — tags and metadata chips.
- `Checkbox` — accessible toggle (used in settings).
- `Dialog` — focus-trapped modal (delete confirmation). Portaled to `document.body`.
- `Toast` — `ToastProvider` + `useToast()`; replaces inline status paragraphs app-wide.
- `EmptyState` — icon, explanation and a suggested action (never a blank page).
- `Spinner`, `Skeleton`, `SkeletonList` — loading states; skeleton avoids blank screens.

---

## Adding a token

Worked example — adding a warning colour:

**1. Add it to the token module** (`src/shared/styles/tokens.ts`):

```ts
export const status = {
  success: '#15803d',
  danger: '#b91c1c',
  warning: '#b45309',   // new
} as const;
```

**2. Use it.** In Tailwind-styled UI, reference the palette; in the injected stylesheet, interpolate
the token:

```ts
.avs-toast[data-variant='warning'] { background: ${color.status.warning}; }
```

**3. Run the tests.** `tokens.test.ts` already validates that every hex in the injected CSS is a known
token, so the new value passes only because it is a token.

```bash
npm run test -- src/shared/styles
```

**Never** skip step 1 and inline `#b45309`. The test will fail, and correctly.

---

## Review checklist

- [ ] No hex, rgb or hsl literal outside `tokens.ts`
- [ ] No magic pixel values for radius, shadow or z-index
- [ ] Semantic alias used where one exists, rather than a raw ramp value
- [ ] Dark variant provided for every new surface and text colour
- [ ] New animation wrapped in a `prefers-reduced-motion` guard
- [ ] Popup still free of horizontal overflow at 320 px
- [ ] Icon-only controls use `IconButton` with a `label`
