import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildHighlightData,
  createHandlers,
  explainWord,
  readActiveSelection,
  saveSelection,
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
    explain: Object.assign(new ExplainService(settings), {
      explain: vi.fn(async () => explanation),
      explainWith: vi.fn(async () => explanation),
    }) as unknown as ExplainService,
  };
});

describe('readActiveSelection', () => {
  it('asks the active tab for its selection', async () => {
    chromeMock().tabs.sendMessage.mockResolvedValue({
      ok: true,
      data: { word: 'cake', sentence: 'I like cake.', sourceUrl: 'https://x', sourceTitle: 'X' },
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

  it('includes the cached meaning when present', async () => {
    const entry = await deps.vocabulary.save({ word: 'beta' });
    await deps.vocabulary.update(entry.id, { explanation });
    expect((await buildHighlightData(deps)).entries[0]?.meaning).toBe('A fortunate accident.');
  });
});

describe('explainWord', () => {
  it('caches the explanation on an existing entry', async () => {
    const entry = await deps.vocabulary.save({ word: 'serendipity' });
    await explainWord(deps, { word: 'serendipity', context: 'context' });

    expect((await deps.vocabulary.get(entry.id))?.explanation?.meaning).toBe('A fortunate accident.');
  });

  it('returns an explanation for an unsaved word without storing it', async () => {
    const result = await explainWord(deps, { word: 'unsaved' });
    expect(result.meaning).toBe('A fortunate accident.');
    expect(await deps.vocabulary.count()).toBe(0);
  });

  it('forwards the full request to the explain service', async () => {
    const request = {
      word: 'a piece of cake',
      unit: 'phrase' as const,
      context: 'It was a piece of cake.',
      sourceUrl: 'https://example.com',
      sourceTitle: 'Example',
      sourceLanguage: 'English',
    };
    await explainWord(deps, request);

    expect(deps.explain.explain).toHaveBeenCalledWith(request);
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
    chromeMock().tabs.sendMessage.mockResolvedValue({ ok: true, data: { word: '  ', sentence: '', sourceUrl: '', sourceTitle: '' } });
    const result = await dispatch(createHandlers(deps), { type: 'save-current-selection' }, sender);
    expect(result).toEqual({ ok: true, data: null });
  });

  it('saves the current selection when one exists', async () => {
    chromeMock().tabs.sendMessage.mockResolvedValue({
      ok: true,
      data: { word: 'ephemeral', sentence: 'It is ephemeral.', sourceUrl: 'https://x', sourceTitle: 'X' },
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
});
