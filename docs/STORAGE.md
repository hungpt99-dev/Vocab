# Storage

Where data lives, how it is shaped, and the rules that keep it consistent.

Source: `src/storage/`, `src/features/settings/backup.ts`. Related:
[Architecture](ARCHITECTURE.md#storage-architecture),
[ADR-002](DECISION_LOG.md#adr-002--dexie-behind-a-repository),
[ADR-013](DECISION_LOG.md#adr-013--settings-in-chromestoragelocal-not-indexeddb).

---

## Two stores

| Store | Holds | Accessed via | Why this store |
| --- | --- | --- | --- |
| IndexedDB (Dexie) | Vocabulary entries | `VocabularyRepository` | Structured, indexed, queryable, effectively unbounded |
| `chrome.storage.local` | Settings, key `avs:settings` | `SettingsRepository` | Cheap to read from every surface, and emits cross-context change events |

Settings deliberately do not live in IndexedDB: content scripts need them on every page load, and
`chrome.storage.onChanged` is what lets them react to changes without depending on the service worker,
which may be evicted. See
[ADR-007](DECISION_LOG.md#adr-007--the-content-script-observes-storage-directly).

---

## The repository boundary

**Only `src/storage` may import Dexie.** This is the single most important rule in the codebase after
the security rules.

Repositories expose domain types, never Dexie tables or queries. The UI cannot tell what engine sits
underneath, which is what makes the engine replaceable and the query logic testable in isolation
against `fake-indexeddb`.

Both repositories export a singleton for production use and accept an injected instance for tests:

```ts
export async function createBackup(
  repo: VocabularyRepository = vocabularyRepository,
): Promise<VocabularyBackup> { … }
```

---

## Schema

`src/storage/database.ts`:

```ts
export const DB_NAME = 'ai-vocabulary-saver';
export const DB_VERSION = 1;

db.version(DB_VERSION).stores({
  // `wordKey` is unique so the same word is never stored twice.
  vocabulary: 'id, &wordKey, word, createdAt, updatedAt, favorite, *tags',
});
```

### `vocabulary` table

| Field | Type | Indexed | Description |
| --- | --- | --- | --- |
| `id` | `string` | primary key | Generated identifier |
| `word` | `string` | yes | The selection exactly as the user saved it |
| `wordKey` | `string` | **unique** | Normalised lookup key: lowercased, whitespace-collapsed |
| `phrase` | `string` | no | Larger phrase when the selection was multi-word |
| `sentence` | `string` | no | Sentence surrounding the selection on the source page |
| `sourceUrl` | `string` | no | Page the word came from |
| `sourceTitle` | `string` | no | Page title at save time |
| `note` | `string` | no | User's own note |
| `tags` | `string[]` | multi-entry | Normalised, de-duplicated |
| `favorite` | `boolean` | yes | |
| `explanation` | `Explanation \| null` | no | Cached AI result; see [AI providers](AI_PROVIDER.md#response-parsing) |
| `createdAt` | `number` | yes | Epoch milliseconds |
| `updatedAt` | `number` | yes | Epoch milliseconds |

### Why each index exists

| Index | Serves |
| --- | --- |
| `id` | Primary key lookups for edit and delete |
| `&wordKey` | **Unique.** Enforces de-duplication at the database level, not just in application code |
| `word` | Alphabetical sorting |
| `createdAt` | Default newest-first ordering of the library |
| `updatedAt` | Merge-on-import conflict resolution (newer wins) |
| `favorite` | Favourites filter |
| `*tags` | Multi-entry index; tag filtering without a full scan |

Fields that are only ever displayed — `phrase`, `sentence`, `note`, `explanation` — are deliberately
unindexed. Free-text search filters in memory after an indexed narrowing, which is appropriate for a
personal vocabulary list and avoids the cost of maintaining a text index.

---

## Normalisation and de-duplication

Every entry carries `wordKey`, derived from `word` by lowercasing and collapsing whitespace. The same
normalisation is applied at write time and at match time in the content script, which is what makes
`Serendipity`, `serendipity` and `serendipity ` a single entry.

Because `wordKey` is a **unique** index, saving an existing word is an update, not an insert. This
satisfies FR-1.6 in [Product requirements](PRODUCT_REQUIREMENTS.md#1-capture) and is enforced by the
database rather than by a check that could be forgotten.

Editing a word to one that already exists merges for the same reason.

---

## Migrations

The schema is at **version 1**. No migration has been needed yet, so none exists to describe. The
strategy for when one is:

1. Increment `DB_VERSION`.
2. Add a new `db.version(n).stores({...})` block. **Never edit an existing version block** — Dexie
   replays version history, so editing a shipped version corrupts upgrades for existing users.
3. Supply `.upgrade(tx => …)` when data must be transformed, not merely re-indexed.
4. Add a test that opens a database at the old version, writes representative data, reopens at the new
   version, and asserts the data survived.
5. Bump `BACKUP_SCHEMA_VERSION` if the export shape changes, and handle older backups on import.
6. Record the change in [CHANGELOG](CHANGELOG.md) and, if the decision is contestable, add an ADR.

Rules: migrations must be forward-only, idempotent, and must never drop user data. Adding an index
alone does not require an upgrade function.

---

## Export and import

`src/features/settings/backup.ts`. The format is versioned so future changes remain readable:

```ts
export const BACKUP_SCHEMA_VERSION = 1;

export interface VocabularyBackup {
  schemaVersion: number;
  exportedAt: string;              // ISO 8601
  app: 'ai-vocabulary-saver';
  entries: VocabularyEntry[];
}
```

Exported filenames follow `ai-vocabulary-YYYY-MM-DD.json`.

### Validation

`parseBackup()` treats the file as untrusted and rejects it wholesale before any write:

| Condition | Error |
| --- | --- |
| Not an object | `That file is not a valid vocabulary backup.` |
| `entries` is not an array | `The backup file has no "entries" list.` |
| `schemaVersion` missing, or newer than supported | `This backup was made by a newer version of the extension.` |
| Any entry fails the shape check | `The backup contains malformed entries.` |

An entry must have a string `word` and numeric `createdAt` and `updatedAt`. Rejecting a newer
`schemaVersion` is deliberate: silently importing a format we do not understand would lose fields.

**Nothing is written unless the whole file validates**, so a corrupt import cannot leave the library
half-updated.

### Strategies

| Mode | Behaviour | Use when |
| --- | --- | --- |
| `merge` | Adds new entries; for a `wordKey` collision the entry with the newer `updatedAt` wins | Combining two machines |
| `replace` | Clears the store, then inserts | Restoring a known-good snapshot |

`replace` is destructive and confirmed in the UI before running.

### Backup guidance

Local data has no automatic backup. Export before reinstalling the extension, clearing browser data,
or moving to a new machine. The export is plain JSON — readable, diffable, and not locked to this
application.

Settings, including the API key, are **not** included in the export. This is intentional: a backup
file that carried a live credential would be a disclosure risk every time it was shared or synced.
