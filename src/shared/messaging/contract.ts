import type { ExplainKind } from '@/shared/types/ai';
import type { Explanation, NewVocabularyEntry, VocabularyEntry } from '@/shared/types/vocabulary';
import type { ReadingExperience } from '@/shared/types/settings';
import type { SelectionUnit } from '@/shared/lib/selection';

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
      };
    }
  | { type: 'save-difficult-words'; payload: DifficultWordsPayload }
  | { type: 'translate'; payload: { text: string; language?: string } }
  | { type: 'get-highlight-data' }
  | { type: 'translate-blocks'; payload: { blocks: string[] } }
  | { type: 'translate-article'; payload: { paragraphs: TranslationParagraphPayload[]; language: string } }
  | { type: 'toggle-bilingual-reading' }
  | { type: 'open-options' }
  | { type: 'vocabulary-changed' }
  | { type: 'settings-changed' }
  | { type: 'show-toast'; payload: { message: string; variant: 'success' | 'error' } };

export type MessageType = Message['type'];

/** Highlight payload delivered to content scripts. */
export interface HighlightData {
  enabled: boolean;
  color: string;
  /** Whether bilingual (inline) reading is enabled; the content script shows the
   * headbar and injects translations on the page when this is true. */
  bilingualMode: boolean;
  /** Target language for inline translations. */
  targetLanguage: string;
  /** Reading overlay presentation, applied live via CSS custom properties. */
  readingExperience: ReadingExperience;
  entries: Array<Pick<VocabularyEntry, 'id' | 'word' | 'wordKey' | 'note' | 'createdAt'> & {
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
  'toggle-bilingual-reading': void;
  'open-options': void;
  'vocabulary-changed': void;
  'settings-changed': void;
  'show-toast': void;
}

export type MessageResult<T extends MessageType> =
  | { ok: true; data: ResponseMap[T] }
  | { ok: false; error: string; code?: string };
