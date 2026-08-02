import Dexie from 'dexie';
export const DB_NAME = 'ai-vocabulary-saver';
export const DB_VERSION = 1;
/**
 * Create (but do not open) a Dexie database instance.
 * Exported separately from the singleton so tests can build isolated databases.
 */
export function createDatabase(name = DB_NAME) {
    const db = new Dexie(name);
    db.version(DB_VERSION).stores({
        // `wordKey` is unique so the same word is never stored twice.
        vocabulary: 'id, &wordKey, word, createdAt, updatedAt, favorite, *tags',
    });
    return db;
}
export const db = createDatabase();
