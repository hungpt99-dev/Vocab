import { beforeEach, describe, expect, it } from 'vitest';
import { backupFilename, createBackup, parseBackup, restoreBackup } from './backup';
import { createDatabase } from '@/storage/database';
import { VocabularyRepository } from '@/storage/vocabulary-repository';

let repo: VocabularyRepository;
let counter = 0;

beforeEach(async () => {
  counter += 1;
  const db = createDatabase(`backup-db-${counter}`);
  await db.open();
  repo = new VocabularyRepository(db);
});

describe('createBackup', () => {
  it('produces a versioned payload', async () => {
    await repo.save({ word: 'alpha' });
    const backup = await createBackup(repo);

    expect(backup.schemaVersion).toBe(1);
    expect(backup.app).toBe('ai-vocabulary-saver');
    expect(backup.entries).toHaveLength(1);
    expect(Date.parse(backup.exportedAt)).not.toBeNaN();
  });
});

describe('parseBackup', () => {
  it('accepts a valid backup', async () => {
    await repo.save({ word: 'alpha' });
    const roundTripped = JSON.parse(JSON.stringify(await createBackup(repo)));
    expect(parseBackup(roundTripped).entries).toHaveLength(1);
  });

  it('rejects non-objects', () => {
    expect(() => parseBackup(null)).toThrow(/not a valid/);
    expect(() => parseBackup('nope')).toThrow(/not a valid/);
  });

  it('rejects a missing entries list', () => {
    expect(() => parseBackup({ schemaVersion: 1 })).toThrow(/no "entries" list/);
  });

  it('rejects a future schema version', () => {
    expect(() => parseBackup({ schemaVersion: 99, entries: [] })).toThrow(/newer version/);
  });

  it('rejects malformed entries', () => {
    expect(() => parseBackup({ schemaVersion: 1, entries: [{ word: 1 }] })).toThrow(/malformed/);
  });
});

describe('restoreBackup', () => {
  it('round-trips export then import', async () => {
    await repo.save({ word: 'alpha', note: 'n' });
    await repo.save({ word: 'beta' });
    const backup = parseBackup(JSON.parse(JSON.stringify(await createBackup(repo))));

    await repo.clear();
    const result = await restoreBackup(backup, 'replace', repo);

    expect(result.imported).toBe(2);
    expect(await repo.count()).toBe(2);
    expect((await repo.findByWord('alpha'))?.note).toBe('n');
  });

  it('merges without deleting existing words', async () => {
    await repo.save({ word: 'existing' });
    const backup = { schemaVersion: 1, exportedAt: '', app: 'ai-vocabulary-saver' as const, entries: [] };

    await restoreBackup(backup, 'merge', repo);
    expect(await repo.count()).toBe(1);
  });
});

describe('backupFilename', () => {
  it('embeds the date', () => {
    expect(backupFilename(new Date('2026-03-04T00:00:00Z'))).toBe('ai-vocabulary-2026-03-04.json');
  });
});
