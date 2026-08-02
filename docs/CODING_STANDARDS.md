# Coding Standards

Conventions used in this codebase. Where a rule is mechanically enforced, that is stated; where it is
a review expectation, that is stated too. No convention should be undocumented — if you find one in
the code that is not here, add it.

Related: [Folder structure](FOLDER_STRUCTURE.md), [Design system](DESIGN_SYSTEM.md),
[Testing](TESTING.md).

---

## Enforced rules

These fail the build. `npm run lint` and `npm run typecheck` must both be clean.

| Rule | Setting | Why |
| --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | **error** | `any` disables the type system exactly where it is most needed — at boundaries |
| `no-console` | only `warn`, `error` | Debug logging must not ship; `console.log` is for local work |
| `@typescript-eslint/no-unused-vars` | error, `^_` ignored | Dead bindings signal incomplete refactors |
| `no-undef` | **off for TS** | Cannot see ambient `chrome`; TypeScript does this better. [ADR-011](DECISION_LOG.md#adr-011--no-undef-disabled-for-typescript) |
| TypeScript `strict` | on | |

Test files relax `no-console` and `no-explicit-any`; `e2e/` additionally relaxes
`react-hooks/rules-of-hooks` and `no-empty-pattern`, because Playwright's fixture signature uses a
callback named `use` and a `{}` first parameter that both trip rules written for React.

---

## Naming

| Thing | Convention | Example |
| --- | --- | --- |
| React component file | `PascalCase.tsx` | `EntryCard.tsx` |
| Module / utility file | `kebab-case.ts` | `explain-service.ts` |
| Hook | `useThing.ts` | `useVocabulary.ts` |
| Test | co-located `*.test.ts(x)` | `matcher.test.ts` |
| E2E spec | `e2e/*.spec.ts` | `capture.spec.ts` |
| Type / interface | `PascalCase`, no `I` prefix | `VocabularyEntry` |
| Constant | `SCREAMING_SNAKE_CASE` | `DEFAULT_HIGHLIGHT_COLOR` |
| Boolean | reads as a predicate | `requiresApiKey`, `favoritesOnly` |
| Function | verb first | `buildManifest`, `toExplanation` |
| CSS class in a page | `avs-` prefix | `avs-highlight`, `avs-card` |

The `avs-` prefix exists because those classes land in someone else's document and must not collide.

**Say what it is.** `entry` not `e`, `provider` not `p`. Single letters are acceptable only for a
loop index or a well-understood mathematical variable.

---

## Imports

Use the `@/` alias for anything outside the current folder:

```ts
import { escapeRegExp } from '@/shared/lib/text';   // good
import { escapeRegExp } from '../../shared/lib/text'; // avoid
```

Relative imports are fine for siblings (`./types`, `./highlighter`).

**Import order.** External packages, then `@/` modules, then relative. Type-only imports use
`import type` so they are erased at build time.

---

## TypeScript

**No `any`.** Narrow from `unknown`:

```ts
// Good — validation is forced at the boundary
export function parseBackup(raw: unknown): VocabularyBackup {
  if (typeof raw !== 'object' || raw === null) throw new Error('…');
  const backup = raw as Partial<VocabularyBackup>;
  if (!Array.isArray(backup.entries)) throw new Error('…');
  …
}
```

**No non-null assertions in production code.** `entry!.word` moves a crash to runtime. Handle the
absent case. In tests, `!` is acceptable where the fixture guarantees presence.

**Prefer `interface` for object shapes**, `type` for unions, mapped and utility types. Derive rather
than duplicate:

```ts
export type VocabularyPatch = Partial<Pick<VocabularyEntry, 'word' | 'note' | 'tags' | …>>;
```

**`as const`** for literal objects that act as tokens or presets, so their values stay narrow.

---

## Components

**Presentational by default.** Data access lives in hooks; components receive values and callbacks.
This keeps components testable without mocking storage.

```tsx
// Good
export function AppearanceSettings({ settings, onChange }: Props) { … }

// Avoid — the component now needs a database to render
export function AppearanceSettings() {
  const [settings, setSettings] = useState(await settingsRepository.get());
}
```

**Props.** Declare an explicit `Props` interface. Destructure in the signature. No prop spreading onto
DOM elements unless the component is a deliberate primitive wrapper.

**Accessibility is part of the component contract.** Every interactive element has an accessible name.
Icon-only buttons must use `IconButton`, which requires a `label`.

**Keep them small.** A component that renders and also fetches, formats and validates is doing four
jobs. Split it.

---

## Hooks

- Name starts with `use`; called unconditionally at the top level.
- One responsibility. `useVocabulary` owns vocabulary; it does not also own settings.
- Wrap callbacks exposed to components in `useCallback` so they are stable across renders.
- **Optimistic updates**: apply to state first, persist second, reload from storage on failure. See
  [ADR-009](DECISION_LOG.md#adr-009--optimistic-ui-with-reload-on-failure).

```ts
const update = useCallback(async (patch: SettingsPatch) => {
  setSettings((current) => ({ ...current, ...patch }));   // optimistic
  setSettings(await settingsRepository.update(patch));    // authoritative
}, []);
```

---

## Services and repositories

**Repositories** own persistence and expose domain types. Only `src/storage` imports Dexie. A
repository method never returns a Dexie table, query or promise chain.

**Services** (`ExplainService`) orchestrate: they read settings, pick a provider, call it, parse the
result, and persist. They contain no wire-format knowledge and no rendering.

**Both export a singleton and accept an injected instance**, which is what makes them testable:

```ts
export async function createBackup(
  repo: VocabularyRepository = vocabularyRepository,
): Promise<VocabularyBackup> { … }
```

---

## Dependency injection

Business logic is written as pure functions over injected dependencies. `src/background/handlers.ts`
is the reference example: it is unit-tested with no browser because everything it touches arrives as
an argument.

```ts
export async function saveSelection(deps: Deps, payload: SelectionPayload): Promise<VocabularyEntry>
```

Chrome event wiring stays in `index.ts`; logic stays in `handlers.ts`. If a function needs a global to
work, it needs a parameter instead.

---

## Error handling

| Layer | Convention |
| --- | --- |
| Providers | Throw `AiError` with a stable code. Never throw a bare string |
| Messaging | `dispatch()` is total: every outcome becomes `{ ok: true, data }` or `{ ok: false, error, code }` |
| Repositories | Throw on genuine failure; callers translate for the user |
| UI | Show the error next to the action that caused it, in plain language |

**Never swallow an error.** An empty `catch` is a review blocker. If a failure is genuinely
ignorable, catch it, comment *why*, and move on:

```ts
const text = await response.text().catch(() => '');  // body is optional detail
```

**Never show "something went wrong."** A user who sees `unauthorized` can act; a user who sees a
generic message files a bug.

---

## Logging

There is no logging framework and there should not be one.

- `console.log` is **banned** by lint.
- `console.warn` for a recoverable anomaly worth noticing.
- `console.error` for a genuine failure.
- **Never log an API key, a token, or full page content.** See [Security](SECURITY.md).

Errors surface in the UI, not the console. The console is for developers, not the error channel.

---

## Comments

Explain **why**. The code already says what.

```ts
// Good — records a non-obvious platform constraint
// Chrome injects content scripts as classic scripts, so this bundle must be an IIFE.

// Useless
// Set the highlight colour
```

Document platform quirks at the point where they bite, not in a distant file. Every non-obvious
workaround should name the constraint that forced it.

Delete dead code rather than commenting it out. Version control is the archive.

---

## Performance

- **No per-word DOM passes.** Matching compiles one regex; see
  [ADR-008](DECISION_LOG.md#adr-008--one-compiled-regex-for-matching).
- **Batch and defer** content-script work — `MutationObserver` batches, `requestIdleCallback` defers.
- **Debounce** user-driven queries; search already is.
- **No blocking work at import time.** The popup must be interactive immediately.
- **Question every dependency.** The packaged artifact is ~100 KB and should stay that way.

---

## Security

Summarised here; full detail in [Security](SECURITY.md).

- Never log, commit or export an API key.
- Never use `innerHTML` with page or model content. Build nodes; set `textContent`.
- Escape user-supplied strings before compiling them into a regex (`escapeRegExp`).
- Never add a manifest permission without justifying it in [Security](SECURITY.md).
- Treat page content, model output and import files as untrusted.

---

## Accessibility

- Every interactive element has an accessible name; icon-only buttons use `IconButton`.
- Everything keyboard reachable and operable; focus visible.
- Correct roles on overlays: `tooltip`, `alertdialog`, `status`. Dismissible with `Escape`.
- Respect `prefers-reduced-motion`.
- Popup usable at 320 px with no horizontal overflow.
- Never convey state by colour alone.

E2E tests assert several of these, so a regression fails CI rather than shipping.

---

## Testing

Full strategy in [Testing](TESTING.md). The conventions:

- Test behaviour, not implementation. Query by role and accessible name.
- Co-locate unit tests; keep E2E in `e2e/`.
- A bug fix starts with a failing test.
- No arbitrary `waitForTimeout` in E2E.
- Realistic test data — real words and sentences, never `foo`/`bar`.

---

## Forbidden

| Never | Instead |
| --- | --- |
| `any`, `@ts-ignore`, `@ts-expect-error` to silence a real error | Fix the type |
| Inline lint-disable to get a commit through | Fix the code, or change the rule deliberately |
| Deleting or weakening a failing test | Investigate; the test is usually right |
| `innerHTML` with untrusted content | Build nodes, set `textContent` |
| Hardcoded colours, spacing, fonts | Add a token |
| Dexie outside `src/storage` | Add a repository method |
| `src/shared` importing `src/features` | Move the shared part down, or keep it in the feature |
| Empty `catch` | Handle it, or comment why it is ignorable |
| Committing `dist/`, `*.tsbuildinfo` | Already gitignored; keep it that way |
