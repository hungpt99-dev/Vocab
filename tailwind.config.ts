import type { Config } from 'tailwindcss';
import { brand, layout, radius, typography } from './src/shared/styles/tokens';

/**
 * Tailwind consumes the same design tokens as the content script's injected
 * stylesheet, so the popup/options UI and on-page overlays cannot drift apart.
 * See docs/DESIGN_SYSTEM.md.
 *
 */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: { brand },
      fontFamily: { sans: [...typography.brandStack] },
      borderRadius: { token: radius.md },
      width: { popup: layout.popupWidth },
      minWidth: { popup: layout.popupMinWidth },
    },
  },
  plugins: [],
} satisfies Config;
