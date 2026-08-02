/**
 * Design tokens — the single source of truth for every visual value.
 *
 * Two consumers with different constraints share this file:
 *
 * 1. `tailwind.config.js` builds the utility palette used by the popup and
 *    options pages.
 * 2. `src/content/styles.ts` builds a plain CSS string, because the content
 *    script is injected into arbitrary third-party pages where Tailwind's
 *    utilities are unavailable and a full stylesheet would leak into the host.
 *
 * Because the content script cannot import Tailwind, these two paths could
 * silently drift. `tokens.test.ts` asserts they stay identical.
 *
 * Never hardcode a colour, radius, shadow or font stack anywhere else.
 */

/** Indigo brand ramp, mirrored into the Tailwind `brand` palette. */
export const brand = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
} as const;

/** Neutral slate ramp used for surfaces and text. */
export const slate = {
  50: '#f8fafc',
  400: '#94a3b8',
  800: '#1e293b',
  900: '#0f172a',
} as const;

/** Semantic status colours, consumed via the `tint`/`text` helpers in tokens. */
export const status = {
  success: '#15803d',
  successBg: '#dcfce7',
  successBgDark: '#052e16',
  danger: '#b91c1c',
  dangerBg: '#fee2e2',
  dangerBgDark: '#450a0a',
  warning: '#b45309',
  warningBg: '#fef3c7',
} as const;

/** Default highlight colour, overridable by the user in Settings. */
export const DEFAULT_HIGHLIGHT_COLOR = '#fde68a';

export const color = {
  brand,
  slate,
  status,
  /** Focus ring, matching the Tailwind `ring-brand-600` used in the UI. */
  focusRing: brand[600],
  /** Inverted surface used by the hover card and toast on light and dark pages. */
  overlaySurface: slate[900],
  overlaySurfaceAlt: slate[800],
  overlayText: slate[50],
  overlayMuted: slate[400],
  /** Light reading surface used by reading mode on top of any host page. */
  readingSurface: slate[50],
  readingHeader: brand[50],
  readingText: slate[900],
  readingMuted: slate[400],
} as const;

/** Tailwind utility strings for semantic status colours (light + dark). */
export const tints = {
  dangerText: 'text-red-600 dark:text-red-400',
  dangerBorder: 'border-red-500',
  successText: 'text-green-700 dark:text-green-400',
  warningText: 'text-amber-600 dark:text-amber-400',
} as const;

/** Toast/alert surface palettes (border, background, text) per status. */
export const statusSurface = {
  success:
    'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200',
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
  info: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
} as const;

export const radius = {
  sm: '3px',
  md: '8px',
} as const;

export const spacing = {
  xs: '4px',
  sm: '6px',
  md: '10px',
  lg: '12px',
  xl: '16px',
} as const;

export const elevation = {
  overlay: '0 8px 24px rgba(15, 23, 42, 0.35)',
} as const;

export const typography = {
  /** System stack: overlays must render before any webfont loads. */
  systemStack: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  brandStack: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
  overlayBody: '13px/1.5',
  overlayCompact: '13px/1.4',
  overlayLabel: '11px',
  /** Reading-mode article text and headings (a full page surface, not an overlay). */
  readingBody: '15px/1.6',
  readingHeading: '17px/1.5',
} as const;

export const motion = {
  /** Kept short; overlays appear next to the cursor and must not feel laggy. */
  fast: '150ms',
  easing: 'ease-out',
} as const;

export const zIndex = {
  /** Above in-page content but below injected overlays. Used by portaled modals. */
  modal: 60,
  /** Maximum signed 32-bit value: overlays must beat any host-page stacking. */
  overlay: 2147483647,
} as const;

export const layout = {
  overlayMaxWidth: '320px',
  /** Narrowest supported popup width, asserted by an E2E test. */
  popupMinWidth: '320px',
  popupWidth: '384px',
  /** Comfortable measure for the reading-mode text column. */
  readingMaxWidth: '720px',
} as const;
