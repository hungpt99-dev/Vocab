import { describe, expect, it } from 'vitest';
import { createDatabase } from './database';
import { VocabularyRepository } from './vocabulary-repository';
import type { LinguisticAnalyzer } from '@/features/vocabulary/linguistic-analyzer';
import type { LinguisticAnalysis } from '@/features/vocabulary/types';
import { DefaultVocabularyNormalizationService } from '@/features/vocabulary/vocabulary-normalization-service';

let counter = 0;

// Mimic the AI-backed analyzer: it groups inflectional variants into one family.
const ANALYZER: LinguisticAnalyzer = {
  analyze: async (word: string): Promise<LinguisticAnalysis> => {
    const w = word.toLowerCase();
    if (w === 'apple') return { singular: 'apple', lemma: 'apple', partOfSpeech: 'noun', familyId: 'apple', confident: true };
    if (w === 'apples') return { singular: 'apple', lemma: 'apple', partOfSpeech: 'noun', familyId: 'apple', confident: true };
    return { singular: w, lemma: w, partOfSpeech: 'unknown', familyId: w, confident: true };
  },
};

function makeRepo(): VocabularyRepository {
  counter += 1;
  const db = createDatabase(`repro-${counter}`);
  const repo = new VocabularyRepository(db, new DefaultVocabularyNormalizationService({ analyzer: ANALYZER }), async () => 'u');
  return repo;
}

describe('REPRO: saving a word keeps distinct words as separate entries', () => {
  it('saving "apple" when "apples" already exists keeps BOTH (old word not overwritten)', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();

    const first = await repo.save({ word: 'apples' });
    const result = await repo.save({ word: 'apple', sentence: 'I ate an apple.' });

    // Each distinct word is its own entry — the previously saved word survives.
    expect(result.id).not.toBe(first.id);
    expect(result.word).toBe('apple');
    expect(result.wordKey).toBe('apple');
    expect(await repo.count()).toBe(2);
    // The original "apples" entry is still present and unchanged.
    const apples = await repo.findByWord('apples');
    expect(apples?.id).toBe(first.id);
  });

  it('re-saving the same surface form does NOT churn the existing entry', async () => {
    const repo = makeRepo();
    await (repo as unknown as { db: { open(): Promise<void> } }).db.open();

    const first = await repo.save({ word: 'Apples', note: 'first' });
    const again = await repo.save({ word: 'apples', note: 'second' });

    expect(again.id).toBe(first.id);
    // Surface form preserved (case of the original kept), no churn.
    expect(again.surfaceForm).toBe('Apples');
    expect(again.note).toBe('second'); // note is overwritten by new save
    expect(await repo.count()).toBe(1);
  });
});
