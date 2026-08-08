/* Content-script icons, sourced from `lucide-static` instead of hand-inlined
 * path data so glyphs track upstream. lucide-static ships full 24x24 SVG
 * strings; `icon()` strips their wrapper and re-wraps at the overlays' fixed
 * size so the injected markup stays compact and never leaks the lucide class
 * into the host page. */
import {
  AlignVerticalJustifyStart,
  AlignHorizontalSpaceBetween,
  Book,
  Bookmark,
  BookOpen,
  Copy,
  FileText,
  Languages,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Settings,
  Sparkles,
  Wand2,
  X,
} from 'lucide-static';

const WRAP_START =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const WRAP_END = '</svg>';

/** Strip the `<svg …>` wrapper of a lucide-static string, keeping its inner markup. */
const unwrap = (svg: string): string =>
  svg.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** Build an inline SVG for the overlays from a lucide-static source string. */
export const icon = (paths: string): string => `${WRAP_START}${unwrap(paths)}${WRAP_END}`;

export const ICON_SPARKLES = icon(Sparkles);
export const ICON_LANGUAGES = icon(Languages);
export const ICON_BOOKMARK = icon(Bookmark);
export const ICON_COPY = icon(Copy);
export const ICON_MORE = icon(MoreHorizontal);
export const ICON_CLOSE = icon(X);
export const ICON_SETTINGS = icon(Settings);
export const ICON_BOOK_OPEN = icon(BookOpen);
export const ICON_MESSAGE = icon(MessageSquare);
export const ICON_BOOK = icon(Book);
export const ICON_MINIMIZE = icon(Minimize2);
export const ICON_FILE = icon(FileText);
export const ICON_WAND = icon(Wand2);
/** Bilingual-book sentence alignment toggle (stacked facing lines). */
export const ICON_ALIGN_SENTENCE = icon(AlignVerticalJustifyStart);
/** Word-by-word interlinear gloss mode (two facing columns). */
export const ICON_GLOSS_WORD = icon(AlignHorizontalSpaceBetween);
