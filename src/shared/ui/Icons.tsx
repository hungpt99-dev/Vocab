import { Star, Pencil, Trash2, X, Search, Settings, Plus, Filter, AlertCircle, CheckCircle2, BookOpen, Sparkles, Download, Upload, Languages, KeyRound, Database, Palette, SlidersHorizontal, Wand2, ChevronDown, ChevronRight, Flame, CalendarDays, ArrowRight, RotateCw, Layers, HelpCircle } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

/**
 * Central icon set for the app.
 *
 * All icons come from `lucide-react` (consistent stroke style, correct sizes,
 * proper alignment) in keeping with the design standard — never emoji, unicode
 * glyphs, or ASCII as icons.
 *
 * Each export is the Lucide component wrapped to keep the icon's accessible
 * behaviour consistent: when a `label` is supplied the caller exposes the
 * accessible name (e.g. via a wrapping `IconButton`), so the SVG stays visible
 * to assistive tech; otherwise the decorative SVG is hidden with `aria-hidden`.
 */

type IconComponent = typeof Star;

function build(Glyph: IconComponent) {
  return function AppIcon({ label, ...props }: LucideProps & { label?: string }) {
    return <Glyph {...props} aria-hidden={label ? undefined : true} />;
  };
}

export const StarIcon = build(Star);
export const StarOutlineIcon = build(Star);
export const PencilIcon = build(Pencil);
export const TrashIcon = build(Trash2);
export const XIcon = build(X);
export const SearchIcon = build(Search);
export const SettingsIcon = build(Settings);
export const PlusIcon = build(Plus);
export const FilterIcon = build(Filter);
export const AlertIcon = build(AlertCircle);
export const CheckIcon = build(CheckCircle2);
export const BookIcon = build(BookOpen);
export const SparklesIcon = build(Sparkles);
export const LanguagesIcon = build(Languages);
export const DownloadIcon = build(Download);
export const UploadIcon = build(Upload);
export const KeyIcon = build(KeyRound);
export const DatabaseIcon = build(Database);
export const PaletteIcon = build(Palette);
export const SlidersIcon = build(SlidersHorizontal);
export const WandIcon = build(Wand2);
export const ChevronDownIcon = build(ChevronDown);
export const ChevronRightIcon = build(ChevronRight);
export const FlameIcon = build(Flame);
export const CalendarDaysIcon = build(CalendarDays);
export const ArrowRightIcon = build(ArrowRight);
export const RotateCwIcon = build(RotateCw);
export const LayersIcon = build(Layers);
export const HelpCircleIcon = build(HelpCircle);
