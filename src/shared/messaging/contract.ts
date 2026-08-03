import type { Explanation, NewVocabularyEntry, VocabularyEntry } from '@/shared/types/vocabulary';

/** Payload the content script reports about the current selection. */
export interface SelectionPayload {
  word: string;
  sentence: string;
  sourceUrl: string;
  sourceTitle: string;
}

export type Message =
  | { type: 'save-entry'; payload: NewVocabularyEntry }
  | { type: 'get-selection' }
  | { type: 'save-current-selection' }
  | { type: 'explain'; payload: { word: string; context?: string } }
  | { type: 'translate'; payload: { text: string; context?: string } }
  | { type: 'open-options' }
  | { type: 'get-highlight-data' }
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
  translate: string;
  'open-options': void;
  'get-highlight-data': HighlightData;
  'vocabulary-changed': void;
  'settings-changed': void;
  'show-toast': void;
}

export type MessageResult<T extends MessageType> =
  | { ok: true; data: ResponseMap[T] }
  | { ok: false; error: string; code?: string };
