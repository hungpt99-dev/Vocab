import type { ExplainKind } from '@/shared/types/ai';
import type { Explanation, NewVocabularyEntry, VocabularyEntry } from '@/shared/types/vocabulary';
import type { ReadingExperience } from '@/shared/types/settings';
import type { SelectionUnit } from '@/shared/lib/selection';
import type { WordAlignResult } from '@/ai/types';

/** Payload the content script reports about the current selection. */
export interface SelectionPayload {
  word: string;
  sentence: string;
  /** Short excerpt of text immediately before the selection on the page. */
  precedingText: string;
  /** Detected selection unit, when the text can be classified. */
  unit?: SelectionUnit;
  /** Detected source language of the selection (BCP-47-ish label, '' when unknown). */
  sourceLanguage?: string;
  sourceUrl: string;
  sourceTitle: string;
}

/** Payload for saving the difficult words found in a selection. */
export interface DifficultWordsPayload {
  word: string;
  context?: string;
  sourceUrl: string;
  sourceTitle: string;
  /** Detected source language of the selection (BCP-47-ish label, '' when unknown). */
  sourceLanguage: string;
}

/** A paragraph the content script asks to be translated. */
export interface TranslationParagraphPayload {
  id: string;
  text: string;
}

/** A paragraph plus its translation. */
export interface TranslatedParagraphPayload {
  id: string;
  text: string;
  translation: string;
  /** Optional timing breakdown, attached for bilingual debug logging. */
  perf?: import('@/ai/types').BilingualPerf;
}

export type Message =
  | { type: 'save-entry'; payload: NewVocabularyEntry }
  | { type: 'save-selection'; payload: SelectionPayload }
  | { type: 'get-selection' }
  | { type: 'save-current-selection' }
  | {
      type: 'explain';
      payload: {
        word: string;
        context?: string;
        kind?: ExplainKind;
        unit?: SelectionUnit;
        sourceLanguage?: string;
        pageTitle?: string;
        precedingText?: string;
        /** Target language for the explanation/translation (learner's language). */
        language?: string;
      };
    }
  | { type: 'save-difficult-words'; payload: DifficultWordsPayload }
  | { type: 'translate'; payload: { text: string; language?: string } }
  | { type: 'get-highlight-data' }
  | { type: 'translate-blocks'; payload: { blocks: string[] } }
  | { type: 'translate-article'; payload: { paragraphs: TranslationParagraphPayload[]; language: string } }
  | { type: 'align-words'; payload: { paragraphs: TranslationParagraphPayload[]; language: string } }
  | { type: 'toggle-bilingual-reading' }
  | { type: 'bilingual:refresh'; force?: boolean }
  | { type: 'am-i-active-tab' }
  | { type: 'bilingual:reconcile' }
  | { type: 'open-options' }
  | { type: 'vocabulary-changed' }
  | { type: 'settings-changed' }
  | { type: 'radar-changed' }
  | { type: 'show-toast'; payload: { message: string; variant: 'success' | 'error' } }
  | { type: 'delete-entry'; payload: { id: string } }
  | {
      type: 'radar:save';
      payload: {
        word: string;
        wordKey: string;
        sentence?: string;
        sourceUrl?: string;
        sourceTitle?: string;
        sourceLanguage?: string;
      };
    }
  | { type: 'radar:remove'; payload: { wordKey: string } }
  | { type: 'radar:list' };

export type MessageType = Message['type'];

/** Highlight payload delivered to content scripts. */
export interface HighlightData {
  enabled: boolean;
  color: string;
  /** Whether the shared reading mode (Bilingual + Radar auto-find) is on for the
   * current page, computed by the background so the content script doesn't need
   * to re-derive scope. One of: 'off' | 'allowed' | 'everywhere'. */
  readingMode: 'off' | 'allowed' | 'everywhere';
  /** When readingMode is 'allowed', the hostnames reading aids activate on. */
  allowedDomains: string[];
  /** Target language for inline translations. */
  targetLanguage: string;
  /** Reading overlay presentation, applied live via CSS custom properties. */
  readingExperience: ReadingExperience;
  /** Generated Radar candidates (from saved vocabulary) to highlight on the page. */
  radar: Array<{
    word: string;
    wordKey: string;
    relationship: string;
    reason: string;
    sourceWords: string[];
  }>;
  entries: Array<Pick<VocabularyEntry, 'id' | 'word' | 'wordKey' | 'note' | 'createdAt' | 'sourceLanguage'> & {
    meaning: string;
    pronunciation: string;
    explanation: VocabularyEntry['explanation'];
  }>;
}

export interface ResponseMap {
  'save-entry': VocabularyEntry;
  'save-selection': VocabularyEntry;
  'get-selection': SelectionPayload | null;
  'save-current-selection': VocabularyEntry | null;
  explain: Explanation;
  'save-difficult-words': VocabularyEntry[];
  translate: string;
  'get-highlight-data': HighlightData;
  /** One translated string per input block; null marks a per-block failure. */
  'translate-blocks': Array<string | null>;
  'translate-article': TranslatedParagraphPayload[];
  'align-words': WordAlignResult[];
  'toggle-bilingual-reading': void;
  'bilingual:refresh': void;
  'am-i-active-tab': boolean;
  'bilingual:reconcile': void;
  'open-options': void;
  'vocabulary-changed': void;
  'settings-changed': void;
  'radar-changed': void;
  'show-toast': void;
  'delete-entry': void;
  'radar:save': VocabularyEntry;
  'radar:remove': void;
  'radar:list': import('@/features/radar/types').RadarEntryView[];
}

export type MessageResult<T extends MessageType> =
  | { ok: true; data: ResponseMap[T] }
  | { ok: false; error: string; code?: string };
