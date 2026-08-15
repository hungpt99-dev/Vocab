import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildHighlightData,
  createHandlers,
  explainWord,
  readActiveSelection,
  saveDifficultWords,
  saveSelection,
  splitVocabularyTerm,
  translateUnit,
  deleteVocabulary,
  type BackgroundDeps,
} from './handlers';
import { createDatabase } from '@/storage/database';
import { TranslateService } from '@/ai/translate-service';
import { VocabularyRepository } from '@/storage/vocabulary-repository';
import { SettingsRepository } from '@/storage/settings-repository';
import { ExplainService } from '@/ai/explain-service';
import { dispatch } from '@/shared/messaging/router';
import { chromeMock } from '@/test/chrome-mock';
import type { Explanation } from '@/shared/types/vocabulary';

vi.mock('@/features/radar/radar-generator', () => ({
  radarGeneratorService: {
    generate: vi.fn(async () => ({
      candidates: [{ word: 'neighbor', relationship: 'related', reason: 'A connected term.' }],
    })),
  },
}));

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
    review: {
      ensureScheduled: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    } as unknown as import('@/storage/review-repository').ReviewRepository,
    explain: Object.assign(new ExplainService(settings), {
      explain: vi.fn(async () => ({ ...explanation })),
      explainWith: vi.fn(async () => ({ ...explanation })),
    }) as unknown as ExplainService,
    translate: {
      translate: vi.fn(async () => []),
    } as unknown as TranslateService,
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
    expect(deps.explain.explainWith).not.toHaveBeenCalled();
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
    (deps.explain.explainWith as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
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
      language: 'English',
      promptTemplate: '',
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
      language: 'English',
      promptTemplate: '',
    });
  });

  it('prefers an explicit language over the settings default', async () => {
    await explainWord(deps, 'mot', 'context', 'native', undefined, undefined, 'Vietnamese');
    expect(deps.explain.explain).toHaveBeenCalledWith({
      word: 'mot',
      context: 'context',
      kind: 'native',
      language: 'Vietnamese',
      promptTemplate: '',
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
      sourceLanguage: '',
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
      sourceLanguage: '',
    });

    expect(deps.explain.explain).toHaveBeenCalledWith({
      word: 'Nothing hard here.',
      context: 'Nothing hard here.',
      kind: 'vocabulary',
      language: 'English',
      promptTemplate: '',
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
      sourceLanguage: '',
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

  it('handles get-selection by reading the active tab', async () => {
    chromeMock().tabs.sendMessage.mockResolvedValue({
      ok: true,
      data: {
        word: 'serendipity',
        sentence: 'Pure serendipity struck.',
        precedingText: 'Everyone noticed',
        sourceUrl: 'https://x',
        sourceTitle: 'X',
      },
    });

    const result = await dispatch(createHandlers(deps), { type: 'get-selection' }, sender);
    expect(result).toMatchObject({
      ok: true,
      data: { word: 'serendipity', sentence: 'Pure serendipity struck.' },
    });
  });

  it('returns null from get-selection when no content script is present', async () => {
    chromeMock().tabs.sendMessage.mockRejectedValue(new Error('no receiver'));

    const result = await dispatch(createHandlers(deps), { type: 'get-selection' }, sender);
    expect(result).toEqual({ ok: true, data: null });
  });

  it('handles explain', async () => {
    const result = await dispatch(
      createHandlers(deps),
      { type: 'explain', payload: { word: 'cake' } },
      sender,
    );
    expect(result).toMatchObject({ ok: true, data: { meaning: 'A fortunate accident.' } });
  });

  it('fills a missing translation via keyless Google when the target language is not English', async () => {
    // The AI returned no `translation`; the user's target language is Vietnamese.
    await deps.settings.update({ targetLanguage: { code: 'vi-VN', name: 'Vietnamese' } });
    (deps.translate.translate as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'w', text: 'cake', translation: 'bánh' },
    ]);
    const result = await dispatch(
      createHandlers(deps),
      { type: 'explain', payload: { word: 'cake' } },
      sender,
    );
    expect(result).toMatchObject({ ok: true, data: { translation: 'bánh' } });
    expect(deps.translate.translate).toHaveBeenCalledWith(
      [{ id: 'w', text: 'cake' }],
      'Vietnamese',
    );
  });

  it('does not translate when the AI already returned a translation', async () => {
    await deps.settings.update({ targetLanguage: { code: 'vi-VN', name: 'Vietnamese' } });
    // Use a one-off explanation fixture that already has a translation so we do
    // not mutate the shared `explanation` object used by other tests.
    (deps.explain.explain as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...explanation,
      translation: 'bánh',
    });
    const result = await dispatch(
      createHandlers(deps),
      { type: 'explain', payload: { word: 'cake' } },
      sender,
    );
    expect(result).toMatchObject({ ok: true, data: { translation: 'bánh' } });
    expect(deps.translate.translate).not.toHaveBeenCalled();
  });

  it('does not translate when the target language is English', async () => {
    await deps.settings.update({ targetLanguage: { code: 'en-US', name: 'English' } });
    const result = await dispatch(
      createHandlers(deps),
      { type: 'explain', payload: { word: 'cake' } },
      sender,
    );
    expect(result).toMatchObject({ ok: true, data: { translation: '' } });
    expect(deps.translate.translate).not.toHaveBeenCalled();
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
      language: 'English',
      promptTemplate: '',
    });
  });

  it('handles radar:generate by enriching then producing Radar candidates', async () => {
    const saved = await deps.vocabulary.save({ word: 'risk', sentence: 'We mitigate risk.' });
    expect((await deps.vocabulary.findByWord('risk'))?.explanation).toBeNull();

    const result = await dispatch(createHandlers(deps), { type: 'radar:generate', payload: { id: saved.id } }, sender);

    expect(result.ok).toBe(true);
    // The un-enriched word was enriched so generation had meaning to work with.
    expect(deps.explain.explain).toHaveBeenCalled();
    // Candidates were generated and broadcast.
    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({ type: 'radar-changed' });
  });

  it('handles radar:generate-all by generating for every enriched saved word lacking Radar', async () => {
    const a = await deps.vocabulary.save({ word: 'alpha', sentence: 'Alpha one.' });
    await deps.vocabulary.update(a.id, { explanation });
    const b = await deps.vocabulary.save({ word: 'beta', sentence: 'Beta two.' });
    await deps.vocabulary.update(b.id, { explanation });
    // A saved word with no explanation is skipped.
    await deps.vocabulary.save({ word: 'gamma', sentence: 'Gamma three.' });

    const result = await dispatch(createHandlers(deps), { type: 'radar:generate-all' }, sender);

    expect(result.ok).toBe(true);
    // Both enriched words produced candidates and broadcast at least one change.
    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({ type: 'radar-changed' });
  }, 15000);

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

describe('translateUnit default language', () => {
  it('translates into the user target language when none is provided', async () => {
    const translate = { translate: vi.fn(async () => [{ id: 'unit', text: 'unit', translation: 'x' }]) };
    const depsWithLang: BackgroundDeps = {
      ...deps,
      settings: { get: vi.fn(async () => ({ ...(await deps.settings.get()), targetLanguage: { code: 'vi-VN', name: 'Vietnamese' } })) } as unknown as import('@/storage/settings-repository').SettingsRepository,
      translate: translate as unknown as TranslateService,
    };
    const result = await translateUnit(depsWithLang, { text: 'hello' });
    expect(result).toBe('x');
    expect(translate.translate).toHaveBeenCalledWith([{ id: 'unit', text: 'hello' }], 'Vietnamese');
  });

  it('falls back to English when settings are unavailable', async () => {
    const translate = { translate: vi.fn(async () => [{ id: 'unit', text: 'unit', translation: 'x' }]) };
    const depsBroken: BackgroundDeps = {
      ...deps,
      settings: { get: vi.fn(async () => { throw new Error('boom'); }) } as unknown as import('@/storage/settings-repository').SettingsRepository,
      translate: translate as unknown as TranslateService,
    };
    const result = await translateUnit(depsBroken, { text: 'hello' });
    expect(result).toBe('x');
    expect(translate.translate).toHaveBeenCalledWith([{ id: 'unit', text: 'hello' }], 'English');
  });
});

describe('deleteVocabulary', () => {
  it('removes the saved entry and drops it as a Radar source', async () => {
    const saved = await deps.vocabulary.save({ word: 'mitigate', sentence: 'We mitigate risk.' });
    expect(await deps.vocabulary.findByWord('mitigate')).toBeDefined();

    await deleteVocabulary(deps, saved.id);

    expect(await deps.vocabulary.findByWord('mitigate')).toBeUndefined();
    // The dropped-source step still broadcasts radar-changed (best-effort).
    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({ type: 'radar-changed' });
  });
});

describe('isActiveTab (VOC-143 bilingual gate)', () => {
  it('returns true when the sender tab is active, even if tabs.query/currentWindow yields nothing', async () => {
    // Reproduce the real-world failure: from a service worker,
    // chrome.tabs.query({ active: true, currentWindow: true }) returns nothing
    // (currentWindow is meaningless in the worker context), which previously made
    // isActiveTab return false and silently closed the bilingual reader.
    chromeMock().tabs.query.mockResolvedValue([]);
    chromeMock().tabs.get.mockResolvedValue({ id: 42, active: true, currentWindow: true });

    const { isActiveTab } = await import('./handlers');
    expect(await isActiveTab(42)).toBe(true);
  });

  it('returns false when the sender tab exists but is not the active tab', async () => {
    chromeMock().tabs.get.mockResolvedValue({ id: 42, active: false });
    const { isActiveTab } = await import('./handlers');
    expect(await isActiveTab(42)).toBe(false);
  });

  it('returns false when there is no sender tab id', async () => {
    const { isActiveTab } = await import('./handlers');
    expect(await isActiveTab(undefined)).toBe(false);
  });
});


