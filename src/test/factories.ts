import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { normalizeWord } from '@/shared/lib/text';

/**
 * Test helper: build a fully-formed VocabularyEntry with deterministic defaults
 * for the fields the Save-Word pipeline added (userId, surfaceForm, normalized
 * form, lemma, familyId, partOfSpeech). Pass a partial to override any field.
 */
export function makeVocabularyEntry(
  partial: Partial<VocabularyEntry> & { word: string },
): VocabularyEntry {
  const wordKey = partial.wordKey ?? normalizeWord(partial.word);
  return {
    id: partial.id ?? `id-${wordKey}`,
    word: partial.word,
    wordKey,
    userId: partial.userId ?? 'test-user',
    surfaceForm: partial.surfaceForm ?? partial.word,
    normalizedForm: partial.normalizedForm ?? wordKey,
    lemma: partial.lemma ?? wordKey,
    familyId: partial.familyId ?? wordKey,
    partOfSpeech: partial.partOfSpeech,
    phrase: partial.phrase ?? '',
    sentence: partial.sentence ?? '',
    sourceUrl: partial.sourceUrl ?? '',
    sourceTitle: partial.sourceTitle ?? '',
    note: partial.note ?? '',
    tags: partial.tags ?? [],
    favorite: partial.favorite ?? false,
    sourceLanguage: partial.sourceLanguage ?? '',
    translation: partial.translation ?? '',
    explanation: partial.explanation ?? null,
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt ?? 1,
  };
}
