import type { Explanation, NewVocabularyEntry, VocabularyEntry } from '@/shared/types/vocabulary';

/** Payload the content script reports about the current selection. */
export interface SelectionPayload {
  word: string;
  sentence: string;
  sourceUrl: string;
  sourceTitle: string;
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
  | { type: 'get-selection' }
  | { type: 'save-current-selection' }
  | { type: 'explain'; payload: { word: string; context?: string } }
  | { type: 'get-highlight-data' }
  | { type: 'translate-article'; payload: { paragraphs: TranslationParagraphPayload[]; language: string } }
  | { type: 'toggle-bilingual-reading' }
  | { type: 'vocabulary-changed' }
  | { type: 'settings-changed' }
  | { type: 'show-toast'; payload: { message: string; variant: 'success' | 'error' } };

export type MessageType = Message['type'];

/** Highlight payload delivered to content scripts. */
export interface HighlightData {
  enabled: boolean;
  color: string;
  entries: Array<Pick<VocabularyEntry, 'id' | 'word' | 'wordKey' | 'note' | 'createdAt'> & {
    meaning: string;
  }>;
}

export interface ResponseMap {
  'save-entry': VocabularyEntry;
  'get-selection': SelectionPayload | null;
  'save-current-selection': VocabularyEntry | null;
  explain: Explanation;
  'get-highlight-data': HighlightData;
  'translate-article': TranslatedParagraphPayload[];
  'toggle-bilingual-reading': void;
  'vocabulary-changed': void;
  'settings-changed': void;
  'show-toast': void;
}

export type MessageResult<T extends MessageType> =
  | { ok: true; data: ResponseMap[T] }
  | { ok: false; error: string; code?: string };
