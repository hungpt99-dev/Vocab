import { isPhrase } from '@/shared/lib/text';
import type { ExplainKind } from '@/shared/types/ai';
import type { SelectionPayload } from '@/shared/messaging/contract';
import { readSelection } from './selection';
import {
  ICON_BOOK,
  ICON_BOOKMARK,
  ICON_FILE,
  ICON_LANGUAGES,
  ICON_MESSAGE,
  ICON_MINIMIZE,
  ICON_SPARKLES,
  ICON_WAND,
} from './icons';

/** The unit of the current selection. Drives which explain prompt the downstream popover uses. */
export type SelectionUnit = 'word' | 'phrase' | 'sentence' | 'paragraph';

export interface ToolbarState {
  /** Non-collapsed selected text, whitespace-collapsed. */
  text: string;
  /** Surrounding sentence of the selection, used as explain context. */
  sentence?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  /** Detected selection unit. */
  unit: SelectionUnit;
  /** Bounding rect of the selection range, viewport-relative. */
  rect: { top: number; bottom: number; left: number; width: number };
  /** Selection metadata captured when the toolbar opened, for saving. */
  selection?: SelectionPayload;
}

/** Every action the toolbar can emit. */
export type ToolbarAnyActionId =
  'generate' | 'explain' | 'xray' | 'simplify' | 'save' | 'copy' | 'more';

/** The smart-AI actions exposed on a translated/selected sentence. */
export type SmartAssistActionId =
  | 'explain-sentence'
  | 'explain-grammar'
  | 'explain-vocabulary'
  | 'simplify'
  | 'summarize'
  | 'examples'
  | 'native'
  | 'related'
  | 'save-difficult-words';

export interface SmartAssistAction {
  id: SmartAssistActionId;
  label: string;
  icon: string;
  /** Which analysis the ExplainService should produce. Absent = repository action. */
  kind?: ExplainKind;
}

export const SMART_ASSIST_ACTIONS: readonly SmartAssistAction[] = [
  { id: 'explain-sentence', label: 'Explain sentence', icon: ICON_MESSAGE, kind: 'sentence' },
  { id: 'explain-grammar', label: 'Explain grammar', icon: ICON_BOOK, kind: 'grammar' },
  {
    id: 'explain-vocabulary',
    label: 'Explain vocabulary',
    icon: ICON_SPARKLES,
    kind: 'vocabulary',
  },
  { id: 'simplify', label: 'Simplify', icon: ICON_MINIMIZE, kind: 'simplify' },
  { id: 'summarize', label: 'Summarize', icon: ICON_FILE, kind: 'summarize' },
  { id: 'examples', label: 'Give examples', icon: ICON_SPARKLES, kind: 'examples' },
  { id: 'native', label: 'Explain in my language', icon: ICON_LANGUAGES, kind: 'native' },
  { id: 'related', label: 'Generate related vocabulary', icon: ICON_WAND, kind: 'related' },
  { id: 'save-difficult-words', label: 'Save difficult words', icon: ICON_BOOKMARK },
];

/**
 * Classify a selection's text into a unit. Mirrors the existing `isPhrase`
 * heuristic but adds sentence/paragraph detection: a selection spanning more
 * than one sentence boundary is treated as a paragraph, a single multi-word
 * span as a phrase, etc.
 */
export function classifySelection(text: string): SelectionUnit {
  const collapsed = text.trim();
  if (!collapsed) return 'word';
  if (isPhrase(collapsed)) {
    const sentenceCount = (collapsed.match(/[.!?\u3002\uff01\uff1f]+(\s|$)/gu) ?? []).length;
    if (sentenceCount >= 2) return 'paragraph';
    if (sentenceCount === 1) return 'sentence';
    return 'phrase';
  }
  return 'word';
}

/** Read the current selection text + unit + viewport-rect, or null if empty. */
export function readToolbarSelection(doc: Document = document): ToolbarState | null {
  const selection = doc.getSelection();
  const text = (selection?.toString() ?? '').trim();
  if (!text || !selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  const payload = readSelection(doc);
  return {
    text,
    sentence: payload?.sentence ?? '',
    sourceUrl: payload?.sourceUrl ?? '',
    sourceTitle: payload?.sourceTitle ?? '',
    unit: classifySelection(text),
    rect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
    selection: readSelection(doc) ?? undefined,
  };
}
