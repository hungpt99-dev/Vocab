import { describe, expect, it } from 'vitest';
import { DefaultVocabularyNormalizationService } from './vocabulary-normalization-service';
import type { LinguisticAnalyzer } from './linguistic-analyzer';
import type { LinguisticAnalysis } from './types';

/** Build a stub analyzer that returns a fixed analysis. */
function stubAnalyzer(analysis: LinguisticAnalysis): LinguisticAnalyzer {
  return { analyze: async () => analysis };
}

describe('VocabularyNormalizationService', () => {
  it('preserves the surface form verbatim while producing normalized fields', async () => {
    const service = new DefaultVocabularyNormalizationService({
      analyzer: stubAnalyzer({
        singular: 'book',
        lemma: 'book',
        partOfSpeech: 'noun',
        familyId: 'book',
        confident: true,
      }),
    });

    const result = await service.normalize('  BOOKS  ');
    expect(result.surfaceForm).toBe('BOOKS');
    expect(result.normalizedForm).toBe('books');
    expect(result.lemma).toBe('book');
    expect(result.familyId).toBe('book');
    expect(result.partOfSpeech).toBe('noun');
    expect(result.familyFallback).toBe(false);
    expect(result.confident).toBe(true);
  });

  it('keeps the original surface form even when the lemma differs', async () => {
    const service = new DefaultVocabularyNormalizationService({
      analyzer: stubAnalyzer({
        singular: 'run',
        lemma: 'run',
        partOfSpeech: 'verb',
        familyId: 'run',
        confident: true,
      }),
    });
    const result = await service.normalize('running');
    expect(result.surfaceForm).toBe('running');
    expect(result.normalizedForm).toBe('running');
    expect(result.lemma).toBe('run');
  });

  it('does not reduce when the analyzer is not confident', async () => {
    const service = new DefaultVocabularyNormalizationService({
      analyzer: stubAnalyzer({
        singular: 'business',
        lemma: 'business',
        partOfSpeech: 'noun',
        familyId: 'business',
        confident: false,
      }),
    });
    const result = await service.normalize('Business');
    expect(result.lemma).toBe('business');
    expect(result.familyFallback).toBe(true);
  });

  it('returns an empty result for blank input without calling the analyzer', async () => {
    const analyzer = { analyze: async () => {
      throw new Error('should not be called');
    } };
    const service = new DefaultVocabularyNormalizationService({ analyzer });
    const result = await service.normalize('   ');
    expect(result.normalizedForm).toBe('');
    expect(result.familyId).toBe('');
  });

  it('marks familyFallback when the analyzer is not confident', async () => {
    const service = new DefaultVocabularyNormalizationService({
      analyzer: stubAnalyzer({
        singular: 'serendipity',
        lemma: 'serendipity',
        partOfSpeech: 'noun',
        familyId: 'serendipity',
        confident: false,
      }),
    });
    const result = await service.normalize('Serendipity');
    expect(result.familyFallback).toBe(true);
  });
});
