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

---

## Word-family normalisation and de-duplication (VOC-140)

Saving a word now runs it through a normalisation pipeline so the same *concept* is never saved
twice, even when the surface forms differ (`book` / `books`, `beautiful` / `beautifully`).

Source: `src/features/vocabulary/`, `src/storage/vocabulary-repository.ts`,
`src/storage/database.ts`. Related: [ADR-014](DECISION_LOG.md#adr-014--ai-backed-linguistic-pipeline).

### Pipeline

```
surfaceForm ──▶ Normalization ──▶ Linguistic analysis (POS / singular / lemma / family)
              (text only)         ──▶ NormalizedWord
```

The four linguistic concerns are kept as **separate responsibilities**, but the actual linguistic
work is delegated to an injected `LinguisticAnalyzer`:

| Stage | Responsibility | File |
| --- | --- | --- |
| Normalization | Text-level cleanup only: trim, lowercase, NFC Unicode normalisation, full-width folding, strip enclosing punctuation. **No linguistics** — `books` stays `books` here. | `word-normalizer.ts` |
| Linguistic analysis | Produces the singular, lemma, part of speech and word-family identity for the word *in its own language*. | `linguistic-analyzer.ts` |
| Orchestration | Runs the two stages in order, preserves the surface form, applies the fallback rule. | `vocabulary-normalization-service.ts` |

**No English-specific rules are hard-coded.** The analyzer is AI-backed: when the user has an AI
provider configured, the model is prompted (via the existing `AiProvider.complete` transport, so it
inherits rate-limiting/retry/fallback) for the word's POS, singular, lemma and family **in whatever
language the user encountered it**. This keeps the behaviour correct for every language the user
studies. When no provider is configured, or a call fails, the analyzer degrades gracefully to a
non-destructive identity (the word is its own lemma/family) so saving never hard-fails.

### Canonical vocabulary identity

Each `VocabularyEntry` now carries:

| Field | Meaning |
| --- | --- |
| `surfaceForm` | Exactly what the user encountered, trimmed (`BOOKS` → `BOOKS`). Preserved verbatim; never overwritten by the canonical form. The UI uses it to show "you encountered: books". |
| `normalizedForm` | Language-agnostic text-normalized form (`books`). |
| `lemma` | Canonical lemma from the pipeline (`book`, `run`, `beautiful`). |
| `familyId` | Word-family identity — the vocabulary concept. `beautiful` and `beautifully` share `beauty`; `book` and `books` share `book`. |
| `partOfSpeech` | Best-effort POS from the analysis. |
| `userId` | Stable per-install owner (see `src/shared/lib/user-id.ts`); scopes the concept so two users can each save the same family. |

### Duplicate detection

The deduplication key is **`(userId, familyId)`**. Two surface forms that resolve to the same family
map to the same key and therefore the same vocabulary concept. A different user may still save the
same family.

Detection is **two-layered**, never a bare `SELECT → INSERT`:

1. A read check: `VocabularyRepository.findByFamily(userId, familyId)` returns the existing entry and
   the save merges into it.
2. A **database-level unique compound index** `&[userId+familyId]` (Dexie v3). A concurrent second
   save of the same family becomes a `ConstraintError` on insert, which the repository catches and
   resolves as "already saved" (re-reads the surviving row and merges) — so concurrent requests
   cannot both pass the read check and create duplicate rows.

No naive string matching (`startsWith`/`contains`/`endsWith`) is ever used to decide families:
`run` and `runaway`, and `analysis` and `analyst`, are deliberately *different* families. Family
membership is decided only by the analyzer's output.

### Fallback behaviour

When the analyzer is **not confident** (no provider, unparseable output, or a transient failure), the
pipeline does not guess. The word becomes its own family identity (`familyFallback = true`,
`familyId = lemma`), and — critically — unrelated words are never merged through fuzzy heuristics.

### Migration (v1 → v3)

The schema is now at **version 3**:

- v2 added the `review` scheduling table.
- v3 adds `userId`, `lemma`, `familyId`, `normalizedForm`, `surfaceForm`, `partOfSpeech` to the
  `vocabulary` table and the unique `[userId+familyId]` index.

The v3 `.upgrade()` backfills the new fields for rows written by older versions (the `wordKey`
becomes the initial `familyId`/`lemma`; a constant `legacy-owner` stands in for `userId` until the
next write stamps the real per-install id). This keeps the unique index satisfiable without dropping
user data. Existing tests open the DB at the current version; the repository tests cover
dedup, multi-user and concurrent-save behaviour.

