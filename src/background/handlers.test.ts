import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildHighlightData,
  createHandlers,
  explainWord,
  readActiveSelection,
  saveDifficultWords,
  saveSelection,
  splitVocabularyTerm,
  type BackgroundDeps,
} from './handlers';
import { createDatabase } from '@/storage/database';
import { VocabularyRepository } from '@/storage/vocabulary-repository';
import { SettingsRepository } from '@/storage/settings-repository';
import { ExplainService } from '@/ai/explain-service';
import { dispatch } from '@/shared/messaging/router';
import { chromeMock } from '@/test/chrome-mock';
import type { Explanation } from '@/shared/types/vocabulary';

const explanation: Explanation = {
  meaning: 'A fortunate accident.',
  simpleExplanation: 'Good luck.',
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
};

const sender = {} as chrome.runtime.MessageSender;
let deps: BackgroundDeps;
let counter = 0;

beforeEach(async () => {
  counter += 1;
  const db = createDatabase(`bg-db-${counter}`);
  await db.open();
  const settings = new SettingsRepository();
  deps = {
    vocabulary: new VocabularyRepository(db),
    settings,
    ai: Object.assign(new ExplainService(settings), {
      explain: vi.fn(async () => explanation),
      explainWith: vi.fn(async () => explanation),
      translate: vi.fn(async () => 'la chance'),
    }) as unknown as ExplainService,
  };
});

describe('readActiveSelection', () => {
  it('asks the active tab for its selection', async () => {
    chromeMock().tabs.sendMessage.mockResolvedValue({
      ok: true,
      data: {
        word: 'cake',
        sentence: 'I like cake.',
        precedingText: 'Everyone says',
        sourceUrl: 'https://x',
        sourceTitle: 'X',
      },
    });

    expect(await readActiveSelection()).toMatchObject({ word: 'cake' });
  });

  it('returns null when there is no active tab', async () => {
    chromeMock().tabs.query.mockResolvedValue([]);
    expect(await readActiveSelection()).toBeNull();
  });

  it('returns null when the tab has no content script', async () => {
    chromeMock().tabs.sendMessage.mockRejectedValue(new Error('no receiver'));
    expect(await readActiveSelection()).toBeNull();
  });
});

describe('saveSelection', () => {
  const selection = {
    word: 'serendipity',
    sentence: 'Pure serendipity.',
    precedingText: 'She found it by',
    sourceUrl: 'https://example.com',
    sourceTitle: 'Example',
  };

  it('persists the selection', async () => {
    const entry = await saveSelection(deps, selection);
    expect(entry.word).toBe('serendipity');
    expect(entry.sourceUrl).toBe('https://example.com');
    expect(await deps.vocabulary.count()).toBe(1);
  });

  it('does not call the AI when auto-explain is off', async () => {
    await saveSelection(deps, selection);
    expect(deps.ai.explainWith).not.toHaveBeenCalled();
  });

  it('attaches an explanation when auto-explain is on', async () => {
    await deps.settings.update({ autoExplainOnSave: true });
    const entry = await saveSelection(deps, selection);
    expect(entry.explanation?.meaning).toBe('A fortunate accident.');
  });

  it('passes page context to the explainer when auto-explain is on', async () => {
    await deps.settings.update({ autoExplainOnSave: true });
    await saveSelection(deps, selection);

    expect(deps.explain.explainWith).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        word: 'serendipity',
        context: 'Pure serendipity.',
        pageTitle: 'Example',
        precedingText: 'She found it by',
      }),
    );
  });

  it('still saves when auto-explain fails', async () => {
    await deps.settings.update({ autoExplainOnSave: true });
    (deps.ai.explainWith as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('no key'),
    );

    const entry = await saveSelection(deps, selection);
    expect(entry.explanation).toBeNull();
    expect(await deps.vocabulary.count()).toBe(1);
  });
});

describe('buildHighlightData', () => {
  it('projects entries and current settings', async () => {
    await deps.vocabulary.save({ word: 'Alpha', note: 'first' });
    await deps.settings.update({ highlightColor: '#ff0000', highlightEnabled: false });

    const data = await buildHighlightData(deps);
    expect(data.enabled).toBe(false);
    expect(data.color).toBe('#ff0000');
    expect(data.entries[0]).toMatchObject({ word: 'Alpha', wordKey: 'alpha', note: 'first', meaning: '' });
  });

  it('carries the reading experience preferences', async () => {
    await deps.settings.update({
      readingExperience: { showOriginal: false, showTranslation: true, width: 400, fontSize: 15, spacing: 1.8 },
    });

    const data = await buildHighlightData(deps);
    expect(data.readingExperience).toEqual({
      showOriginal: false,
      showTranslation: true,
      width: 400,
      fontSize: 15,
      spacing: 1.8,
    });
  });

  it('includes the cached meaning when present', async () => {
    const entry = await deps.vocabulary.save({ word: 'beta' });
    await deps.vocabulary.update(entry.id, { explanation });
    expect((await buildHighlightData(deps)).entries[0]?.meaning).toBe('A fortunate accident.');
  });

  it('includes the pronunciation when an explanation is cached', async () => {
    const entry = await deps.vocabulary.save({ word: 'serendipity' });
    await deps.vocabulary.update(entry.id, { explanation: { ...explanation, pronunciation: '/ˌser.ənˈdɪp.ə.ti/' } });
    expect((await buildHighlightData(deps)).entries[0]?.pronunciation).toBe('/ˌser.ənˈdɪp.ə.ti/');
  });

  it('defaults the pronunciation to empty when absent', async () => {
    await deps.vocabulary.save({ word: 'gamma' });
    expect((await buildHighlightData(deps)).entries[0]?.pronunciation).toBe('');
  });
});

describe('explainWord', () => {
  it('caches the explanation on an existing entry', async () => {
    const entry = await deps.vocabulary.save({ word: 'serendipity' });
    await explainWord(deps, 'serendipity', 'context');

    expect((await deps.vocabulary.get(entry.id))?.explanation?.meaning).toBe('A fortunate accident.');
  });

  it('forwards page context to the explainer', async () => {
    await explainWord(deps, 'serendipity', 'context', undefined, 'Page Title', 'preceding');

    expect(deps.explain.explain).toHaveBeenCalledWith({
      word: 'serendipity',
      context: 'context',
      pageTitle: 'Page Title',
      precedingText: 'preceding',
    });
  });

  it('returns an explanation for an unsaved word without storing it', async () => {
    const result = await explainWord(deps, 'unsaved');
    expect(result.meaning).toBe('A fortunate accident.');
    expect(await deps.vocabulary.count()).toBe(0);
  });

  it('forwards the analysis kind to the explain service', async () => {
    await explainWord(deps, 'a sentence.', 'context', 'summarize');
    expect(deps.explain.explain).toHaveBeenCalledWith({
      word: 'a sentence.',
      context: 'context',
      kind: 'summarize',
    });
  });
});

describe('splitVocabularyTerm', () => {
  it('splits a "term: meaning" item', () => {
    expect(splitVocabularyTerm('serendipity: a fortunate accident')).toEqual({
      word: 'serendipity',
      meaning: 'a fortunate accident',
    });
  });

  it('splits a "term — meaning" item', () => {
    expect(splitVocabularyTerm('ephemeral — short-lived')).toEqual({
      word: 'ephemeral',
      meaning: 'short-lived',
    });
  });

  it('returns the whole item as the word when there is no separator', () => {
    expect(splitVocabularyTerm('just-a-phrase')).toEqual({ word: 'just-a-phrase', meaning: '' });
  });
});

describe('saveDifficultWords', () => {
  it('saves each difficult word extracted by the AI', async () => {
    (deps.explain.explain as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...explanation,
      relatedWords: ['serendipity: a fortunate accident', 'ephemeral: short-lived'],
    });

    const entries = await saveDifficultWords(deps, {
      word: 'Serendipity is ephemeral.',
      context: 'Serendipity is ephemeral.',
      sourceUrl: 'https://example.com',
      sourceTitle: 'Example',
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ word: 'serendipity', note: 'a fortunate accident' });
    expect(entries[1]).toMatchObject({ word: 'ephemeral', note: 'short-lived' });
    expect(await deps.vocabulary.findByWord('serendipity')).toBeDefined();
  });

  it('asks for a vocabulary analysis and saves nothing when no words are found', async () => {
    (deps.explain.explain as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(explanation);

    const entries = await saveDifficultWords(deps, {
      word: 'Nothing hard here.',
      context: 'Nothing hard here.',
      sourceUrl: 'https://example.com',
      sourceTitle: 'Example',
    });

    expect(deps.explain.explain).toHaveBeenCalledWith({
      word: 'Nothing hard here.',
      context: 'Nothing hard here.',
      kind: 'vocabulary',
    });
    expect(entries).toEqual([]);
    expect(await deps.vocabulary.count()).toBe(0);
  });

  it('skips empty extracted terms', async () => {
    (deps.explain.explain as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...explanation,
      relatedWords: ['', '  ', 'cake: a baked dessert'],
    });

    const entries = await saveDifficultWords(deps, {
      word: 'The cake.',
      sourceUrl: 'https://example.com',
      sourceTitle: 'Example',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ word: 'cake' });
  });
});

describe('createHandlers', () => {
  it('handles save-entry', async () => {
    const handlers = createHandlers(deps);
    const result = await dispatch(handlers, { type: 'save-entry', payload: { word: 'cake' } }, sender);

    expect(result.ok).toBe(true);
    expect(await deps.vocabulary.count()).toBe(1);
  });

  it('rejects saving an empty word', async () => {
    const result = await dispatch(createHandlers(deps), { type: 'save-entry', payload: { word: '' } }, sender);
    expect(result).toMatchObject({ ok: false });
  });

  it('returns null when saving with no active selection', async () => {
    chromeMock().tabs.sendMessage.mockResolvedValue({
      ok: true,
      data: { word: '  ', sentence: '', precedingText: '', sourceUrl: '', sourceTitle: '' },
    });
    const result = await dispatch(createHandlers(deps), { type: 'save-current-selection' }, sender);
    expect(result).toEqual({ ok: true, data: null });
  });

  it('saves the current selection when one exists', async () => {
    chromeMock().tabs.sendMessage.mockResolvedValue({
      ok: true,
      data: {
        word: 'ephemeral',
        sentence: 'It is ephemeral.',
        precedingText: 'Time is',
        sourceUrl: 'https://x',
        sourceTitle: 'X',
      },
    });
    const result = await dispatch(createHandlers(deps), { type: 'save-current-selection' }, sender);

    expect(result.ok).toBe(true);
    expect((await deps.vocabulary.findByWord('ephemeral'))?.sentence).toBe('It is ephemeral.');
  });

  it('handles get-highlight-data', async () => {
    const result = await dispatch(createHandlers(deps), { type: 'get-highlight-data' }, sender);
    expect(result).toMatchObject({ ok: true, data: { enabled: true } });
  });

  it('handles explain', async () => {
    const result = await dispatch(
      createHandlers(deps),
      { type: 'explain', payload: { word: 'cake' } },
      sender,
    );
    expect(result).toMatchObject({ ok: true, data: { meaning: 'A fortunate accident.' } });
  });

  it('handles explain with an analysis kind', async () => {
    const result = await dispatch(
      createHandlers(deps),
      { type: 'explain', payload: { word: 'The cat sat down.', kind: 'simplify' } },
      sender,
    );
    expect(result.ok).toBe(true);
    expect(deps.explain.explain).toHaveBeenCalledWith({
      word: 'The cat sat down.',
      kind: 'simplify',
    });
  });

  it('handles save-difficult-words', async () => {
    (deps.explain.explain as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...explanation,
      relatedWords: ['serendipity: a fortunate accident'],
    });

    const result = await dispatch(
      createHandlers(deps),
      {
        type: 'save-difficult-words',
        payload: {
          word: 'Serendipity.',
          context: 'Serendipity.',
          sourceUrl: 'https://example.com',
          sourceTitle: 'Example',
        },
      },
      sender,
    );

    expect(result.ok).toBe(true);
    expect(await deps.vocabulary.findByWord('serendipity')).toBeDefined();
  });
});
