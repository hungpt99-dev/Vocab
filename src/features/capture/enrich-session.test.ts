import { afterEach, describe, expect, it } from 'vitest';
import {
  ENRICH_SESSION_KEY,
  readEnrichSession,
  settleEnrichSession,
  writeEnrichSession,
} from './enrich-session';
import type { Explanation } from '@/shared/types/vocabulary';

afterEach(() => {
  void chrome.storage.local.remove(ENRICH_SESSION_KEY);
});

const explanation: Explanation = {
  meaning: 'A fortunate accident.',
  simpleExplanation: '',
  translation: '',
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
  relatedPhrases: [],
};

describe('enrich-session', () => {
  it('writes and reads a session', async () => {
    writeEnrichSession({ word: 'serendipity', kind: null, enriching: true, explanation: null });
    const session = await readEnrichSession();
    expect(session).toEqual({ word: 'serendipity', kind: null, enriching: true, explanation: null });
  });

  it('settles a matching session with the result (case-insensitive)', async () => {
    writeEnrichSession({ word: 'Serendipity', kind: null, enriching: true, explanation: null });

    await settleEnrichSession('serendipity', explanation);

    const session = await readEnrichSession();
    expect(session).toEqual({
      word: 'Serendipity',
      kind: null,
      enriching: false,
      explanation,
    });
  });

  it('clears the session when the call fails', async () => {
    writeEnrichSession({ word: 'serendipity', kind: null, enriching: true, explanation: null });

    await settleEnrichSession('serendipity', null);

    expect(await readEnrichSession()).toBeNull();
  });

  it('leaves a session for a different word untouched', async () => {
    writeEnrichSession({ word: 'ephemeral', kind: null, enriching: true, explanation: null });

    await settleEnrichSession('serendipity', explanation);

    expect(await readEnrichSession()).toEqual({
      word: 'ephemeral',
      kind: null,
      enriching: true,
      explanation: null,
    });
  });

  it('does nothing when no session exists', async () => {
    await expect(settleEnrichSession('serendipity', explanation)).resolves.toBeUndefined();
    expect(await readEnrichSession()).toBeNull();
  });
});