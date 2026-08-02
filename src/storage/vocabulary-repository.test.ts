import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from './database';
import { VocabularyRepository } from './vocabulary-repository';
import type { VocabularyEntry } from '@/shared/types/vocabulary';

let repo: VocabularyRepository;
let counter = 0;

beforeEach(async () => {
  counter += 1;
  const db = createDatabase(`test-db-${counter}`);
  await db.open();
  repo = new VocabularyRepository(db);
});

describe('save', () => {
  it('stores a new entry with normalised fields', async () => {
    const entry = await repo.save({
      word: '  Serendipity ',
      sentence: 'Some   sentence.',
      tags: ['B', 'a', 'a'],
      sourceUrl: 'https://example.com',
    });

    expect(entry.word).toBe('Serendipity');
    expect(entry.wordKey).toBe('serendipity');
    expect(entry.sentence).toBe('Some sentence.');
    expect(entry.tags).toEqual(['a', 'b']);
    expect(entry.favorite).toBe(false);
    expect(entry.explanation).toBeNull();
    expect(entry.createdAt).toBeGreaterThan(0);
  });

  it('marks multi-word selections as phrases', async () => {
    const entry = await repo.save({ word: 'piece of cake' });
    expect(entry.phrase).toBe('piece of cake');
  });

  it('rejects an empty word', async () => {
    await expect(repo.save({ word: '   ' })).rejects.toThrow('empty word');
  });

  it('merges instead of duplicating an existing word', async () => {
    const first = await repo.save({ word: 'Cake', tags: ['food'] });
    const second = await repo.save({ word: 'cake', note: 'dessert', tags: ['sweet'] });

    expect(second.id).toBe(first.id);
    expect(second.note).toBe('dessert');
    expect(second.tags).toEqual(['food', 'sweet']);
    expect(await repo.count()).toBe(1);
  });
});

describe('lookup', () => {
  it('finds by word case-insensitively', async () => {
    await repo.save({ word: 'Ephemeral' });
    expect((await repo.findByWord('EPHEMERAL'))?.word).toBe('Ephemeral');
  });

  it('returns undefined for unknown words', async () => {
    expect(await repo.findByWord('nothing')).toBeUndefined();
  });
});

describe('update', () => {
  it('patches fields and refreshes the word key', async () => {
    const entry = await repo.save({ word: 'old' });
    const updated = await repo.update(entry.id, { word: 'New Word', note: 'n' });

    expect(updated.word).toBe('New Word');
    expect(updated.wordKey).toBe('new word');
    expect(updated.note).toBe('n');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(entry.updatedAt);
  });

  it('normalises tags on update', async () => {
    const entry = await repo.save({ word: 'w' });
    expect((await repo.update(entry.id, { tags: ['Z', 'z', 'a'] })).tags).toEqual(['a', 'z']);
  });

  it('throws for a missing entry', async () => {
    await expect(repo.update('nope', { note: 'x' })).rejects.toThrow('not found');
  });

  it('rejects clearing the word', async () => {
    const entry = await repo.save({ word: 'w' });
    await expect(repo.update(entry.id, { word: ' ' })).rejects.toThrow('empty word');
  });
});

describe('toggleFavorite', () => {
  it('flips the favorite flag', async () => {
    const entry = await repo.save({ word: 'w' });
    expect((await repo.toggleFavorite(entry.id)).favorite).toBe(true);
    expect((await repo.toggleFavorite(entry.id)).favorite).toBe(false);
  });
});

describe('remove', () => {
  it('deletes an entry', async () => {
    const entry = await repo.save({ word: 'w' });
    await repo.remove(entry.id);
    expect(await repo.get(entry.id)).toBeUndefined();
  });
});

describe('list', () => {
  beforeEach(async () => {
    await repo.save({ word: 'alpha', note: 'first note', tags: ['greek'] });
    await repo.save({ word: 'beta', sentence: 'A beta sentence', tags: ['greek'], favorite: true });
    await repo.save({ word: 'gamma', tags: ['other'] });
  });

  it('returns newest first by default', async () => {
    expect((await repo.list()).map((e) => e.word)).toEqual(['gamma', 'beta', 'alpha']);
  });

  it('sorts alphabetically when requested', async () => {
    const list = await repo.list({ sortBy: 'word', sortDirection: 'asc' });
    expect(list.map((e) => e.word)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('filters favorites', async () => {
    expect((await repo.list({ favoritesOnly: true })).map((e) => e.word)).toEqual(['beta']);
  });

  it('filters by tag', async () => {
    expect((await repo.list({ tag: 'Greek' })).map((e) => e.word)).toEqual(['beta', 'alpha']);
  });

  it('searches word, note, sentence and tags', async () => {
    expect((await repo.list({ search: 'ALPH' })).map((e) => e.word)).toEqual(['alpha']);
    expect((await repo.list({ search: 'first note' })).map((e) => e.word)).toEqual(['alpha']);
    expect((await repo.list({ search: 'beta sentence' })).map((e) => e.word)).toEqual(['beta']);
    expect((await repo.list({ search: 'other' })).map((e) => e.word)).toEqual(['gamma']);
  });

  it('paginates', async () => {
    expect((await repo.list({ limit: 2 })).length).toBe(2);
    expect((await repo.list({ limit: 2, offset: 2 })).map((e) => e.word)).toEqual(['alpha']);
  });
});

describe('listTags / listWordKeys', () => {
  it('returns distinct sorted values', async () => {
    await repo.save({ word: 'One', tags: ['b', 'a'] });
    await repo.save({ word: 'Two', tags: ['a'] });
    expect(await repo.listTags()).toEqual(['a', 'b']);
    expect((await repo.listWordKeys()).sort()).toEqual(['one', 'two']);
  });
});

describe('export / import', () => {
  it('round-trips losslessly', async () => {
    await repo.save({ word: 'alpha', note: 'n', tags: ['x'] });
    await repo.save({ word: 'beta', favorite: true });
    const exported = await repo.exportAll();

    await repo.clear();
    const result = await repo.importAll(exported, 'replace');

    expect(result.imported).toBe(2);
    const reimported = await repo.exportAll();
    expect(reimported.map((e) => e.word)).toEqual(['alpha', 'beta']);
    expect(reimported[0]?.note).toBe('n');
    expect(reimported[1]?.favorite).toBe(true);
  });

  it('skips older duplicates when merging', async () => {
    const entry = await repo.save({ word: 'alpha', note: 'current' });
    const stale: VocabularyEntry = { ...entry, note: 'stale', updatedAt: entry.updatedAt - 1000 };

    const result = await repo.importAll([stale], 'merge');
    expect(result.skipped).toBe(1);
    expect((await repo.findByWord('alpha'))?.note).toBe('current');
  });

  it('applies newer duplicates when merging', async () => {
    const entry = await repo.save({ word: 'alpha', note: 'current' });
    const fresh: VocabularyEntry = { ...entry, note: 'newer', updatedAt: entry.updatedAt + 1000 };

    expect((await repo.importAll([fresh], 'merge')).imported).toBe(1);
    expect((await repo.findByWord('alpha'))?.note).toBe('newer');
  });

  it('skips entries with an empty word', async () => {
    const entry = await repo.save({ word: 'alpha' });
    const broken = { ...entry, id: 'other', word: '  ' };
    expect((await repo.importAll([broken], 'merge')).skipped).toBe(1);
  });
});
