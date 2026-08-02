import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { vocabularyRepository, type VocabularyRepository } from '@/storage/vocabulary-repository';

export const BACKUP_SCHEMA_VERSION = 1;

export interface VocabularyBackup {
  schemaVersion: number;
  exportedAt: string;
  app: 'ai-vocabulary-saver';
  entries: VocabularyEntry[];
}

/** Build a versioned, JSON-serialisable backup of every saved entry. */
export async function createBackup(
  repo: VocabularyRepository = vocabularyRepository,
): Promise<VocabularyBackup> {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'ai-vocabulary-saver',
    entries: await repo.exportAll(),
  };
}

/** Validate an untrusted parsed backup payload. */
export function parseBackup(raw: unknown): VocabularyBackup {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('That file is not a valid vocabulary backup.');
  }
  const backup = raw as Partial<VocabularyBackup>;

  if (!Array.isArray(backup.entries)) {
    throw new Error('The backup file has no "entries" list.');
  }
  if (typeof backup.schemaVersion !== 'number' || backup.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('This backup was made by a newer version of the extension.');
  }
  if (!backup.entries.every(isEntryLike)) {
    throw new Error('The backup contains malformed entries.');
  }

  return {
    schemaVersion: backup.schemaVersion,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : '',
    app: 'ai-vocabulary-saver',
    entries: backup.entries,
  };
}

function isEntryLike(value: unknown): value is VocabularyEntry {
  const entry = value as Partial<VocabularyEntry> | null;
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof entry.word === 'string' &&
    typeof entry.createdAt === 'number' &&
    typeof entry.updatedAt === 'number'
  );
}

/** Restore a validated backup into the repository. */
export async function restoreBackup(
  backup: VocabularyBackup,
  mode: 'merge' | 'replace',
  repo: VocabularyRepository = vocabularyRepository,
): Promise<{ imported: number; skipped: number }> {
  return repo.importAll(backup.entries, mode);
}

/** Suggested filename for a downloaded backup. */
export function backupFilename(date: Date = new Date()): string {
  return `ai-vocabulary-${date.toISOString().slice(0, 10)}.json`;
}
