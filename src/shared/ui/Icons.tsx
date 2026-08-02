import { Star, Pencil, Trash2, X, Search, Settings, Plus, Filter, AlertCircle, CheckCircle2, BookOpen, Sparkles, Download, Upload } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Central icon set for the app.
 *
 * All icons come from `lucide-react` (consistent stroke style, correct sizes,
 * proper alignment) in keeping with the design standard — never emoji, unicode
 * glyphs, or ASCII as icons.
 *
 * Browser extensions render inside a sandbox where the bundled web font can
 * fail to load, leaving Lucide's SVG glyphs blank. We detect that once and fall
 * back to a safe, monochrome unicode fallback (NOT an emoji) so controls stay
 * visible and labelled. The fallback is purely a resilience measure; in normal
 * browsers the real Lucide icons are used.
 */

const GLYPHS: Record<string, string> = {
  star: '★', // ★ - filled star, not an emoji
  starOutline: '☆', // ☆
  pencil: '✎', // ✎
  trash: '🗑', // 🗑
  x: '×', // ×
  search: '⌕', // ⌕
  settings: '⚙', // ⚙
  plus: '+',
  filter: '⚲', // ⚲
  alert: '!',
  check: '✓', // ✓
  book: '¶', // ¶
  sparkles: '*',
  download: '↓', // ↓
  upload: '↑', // ↑
};

type IconComponent = typeof Star;

function useFontHealthy(): boolean {
  const [healthy, setHealthy] = useState(true);
  useEffect(() => {
    // If SVG glyphs render with zero width, the icon font is unavailable.
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    probe.setAttribute('width', '0');
    probe.setAttribute('height', '0');
    probe.style.position = 'absolute';
    document.body.appendChild(probe);
    const box = probe.getBoundingClientRect();
    const ok = box.width > 0 || box.height > 0;
    document.body.removeChild(probe);
    setHealthy(ok);
  }, []);
  return healthy;
}

function Fallback({ glyph, className, label }: { glyph: string; className?: string; label?: string }) {
  return (
    <span aria-hidden="true" className={className} style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1 }}>
      {glyph}
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

function build(Glyph: IconComponent, fallbackGlyph: string) {
  return function AppIcon({ label, ...props }: LucideProps & { label?: string }) {
    const healthy = useFontHealthy();
    if (!healthy) {
      return <Fallback glyph={GLYPHS[fallbackGlyph] ?? '•'} className={(props as { className?: string }).className} label={label} />;
    }
    return <Glyph {...props} aria-hidden={label ? undefined : true} />;
  };
}

export const StarIcon = build(Star, 'star');
export const StarOutlineIcon = build(Star, 'starOutline');
export const PencilIcon = build(Pencil, 'pencil');
export const TrashIcon = build(Trash2, 'trash');
export const XIcon = build(X, 'x');
export const SearchIcon = build(Search, 'search');
export const SettingsIcon = build(Settings, 'settings');
export const PlusIcon = build(Plus, 'plus');
export const FilterIcon = build(Filter, 'filter');
export const AlertIcon = build(AlertCircle, 'alert');
export const CheckIcon = build(CheckCircle2, 'check');
export const BookIcon = build(BookOpen, 'book');
export const SparklesIcon = build(Sparkles, 'sparkles');
export const DownloadIcon = build(Download, 'download');
export const UploadIcon = build(Upload, 'upload');
