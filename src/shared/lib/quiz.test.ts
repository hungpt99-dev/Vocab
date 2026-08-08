import { describe, expect, it } from 'vitest';
import { buildQuiz } from './quiz';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

function entry(word: string, translation: string, meaning = ''): VocabularyEntry {
  return {
    id: `id-${word}`,
    word,
    wordKey: `key-${word}`,
    phrase: '',
    sentence: '',
    sourceUrl: '',
    sourceTitle: '',
    note: '',
    tags: [],
    favorite: false,
    sourceLanguage: 'en',
    explanation: {
      meaning: meaning || translation,
      simpleExplanation: '',
      translation,
      examples: [],
      synonyms: [],
      antonyms: [],
      relatedWords: [],
      pronunciation: '',
      collocations: [],
      grammar: '',
      provider: 'openai',
      model: 'gpt-4o-mini',
      generatedAt: 1,
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('buildQuiz', () => {
  it('returns nothing when fewer than 4 words have explanations', () => {
    const entries = [entry('a', 'x'), entry('b', 'y')];
    expect(buildQuiz(entries)).toEqual([]);
  });

  it('builds questions with a correct answer and 3 unique distractors', () => {
    const entries = [
      entry('apple', 'táo'),
      entry('book', 'sách'),
      entry('cat', 'mèo'),
      entry('dog', 'chó'),
      entry('sun', 'mặt trời'),
    ];
    const questions = buildQuiz(entries, { seed: 7, count: 3 });
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThan(4);
      // The chosen answer option must equal the word's own translation.
      const expected = entries.find((e) => e.word === q.word)!.explanation!.translation;
      expect(q.options[q.answerIndex]).toBe(expected);
    }
  });

  it('is deterministic for a fixed seed', () => {
    const entries = [
      entry('apple', 'táo'),
      entry('book', 'sách'),
      entry('cat', 'mèo'),
      entry('dog', 'chó'),
    ];
    const a = buildQuiz(entries, { seed: 42 });
    const b = buildQuiz(entries, { seed: 42 });
    expect(a).toEqual(b);
  });
});
