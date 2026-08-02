# API Guidelines

**This extension exposes no public HTTP API.** There is no server ([ADR-001](DECISION_LOG.md#adr-001--local-first-with-no-backend)).

"API" here means two things:

1. The **internal message contract** between the four extension surfaces — the interface that matters
   most in day-to-day work.
2. **Outbound calls** to third-party AI providers.

Related: [Architecture](ARCHITECTURE.md#communication-flow), [AI providers](AI_PROVIDER.md).

---

## Part 1 — The internal message contract

Manifest V3 surfaces share no memory, so every cross-surface call is a message. The contract is
declared once, in `src/shared/messaging/contract.ts`, and is the single source of truth for what may
be sent and what comes back.

### Shape

Messages are a discriminated union keyed on `type`:

```ts
export type Message =
  | { type: 'save-entry'; payload: NewVocabularyEntry }
  | { type: 'get-selection' }
  | { type: 'save-current-selection' }
  | { type: 'explain'; payload: { word: string; context?: string } }
  | { type: 'get-highlight-data' }
  | { type: 'vocabulary-changed' }
  | { type: 'settings-changed' }
  | { type: 'show-toast'; payload: { message: string; variant: 'success' | 'error' } };
```

Responses are declared **separately but in parallel**, so a handler cannot return the wrong shape:

```ts
export interface ResponseMap {
  'save-entry': VocabularyEntry;
  'get-selection': SelectionPayload | null;
  'save-current-selection': VocabularyEntry | null;
  explain: Explanation;
  'get-highlight-data': HighlightData;
  'vocabulary-changed': void;
  'settings-changed': void;
  'show-toast': void;
}
```

### Every message returns a result, never a throw

```ts
export type MessageResult<T extends MessageType> =
  | { ok: true; data: ResponseMap[T] }
  | { ok: false; error: string; code?: string };
```

`dispatch()` in `router.ts` is **total**. Success, a thrown error, an unknown message type and a
malformed payload all become a `MessageResult`. Nothing escapes as an unhandled rejection, which
matters because a rejected promise across the message boundary surfaces as an opaque Chrome runtime
error with no useful detail.

`code` carries the `AiError` code when one is available, so the UI can act on the specific failure.

### Conventions

| Convention | Reason |
| --- | --- |
| `kebab-case` type names | Consistent, and reads well in logs |
| Verb-first for commands (`save-entry`), past-tense for events (`vocabulary-changed`) | Distinguishes a request from a notification |
| Payload only when needed | `{ type: 'get-selection' }` carries none |
| Payloads are plain, serialisable data | Messages cross a structured-clone boundary; no class instances, no functions, no `Date` |
| Events return `void` | A broadcast has no meaningful reply |

### Direction

| Message | From | To |
| --- | --- | --- |
| `save-entry` | Popup | Worker |
| `explain` | Popup | Worker |
| `save-current-selection` | Popup | Worker |
| `get-selection` | Worker | Content script |
| `show-toast` | Worker | Content script |
| `get-highlight-data` | Content script | Worker |
| `vocabulary-changed` | Worker | Broadcast |
| `settings-changed` | Worker | Broadcast |

Note that `settings-changed` exists but is **not** the mechanism content scripts rely on — they
observe `chrome.storage.onChanged` directly, because the worker may be asleep. See
[ADR-007](DECISION_LOG.md#adr-007--the-content-script-observes-storage-directly).

### Adding a message type

1. Add the variant to `Message` in `contract.ts`.
2. Add its response type to `ResponseMap`. **TypeScript will now flag every gap** — this is the point
   of declaring them together.
3. Implement the handler in `src/background/handlers.ts` as a pure function over injected
   dependencies.
4. Register it in the handler map.
5. Call it through the typed client in `src/shared/messaging/client.ts`; never call
   `chrome.runtime.sendMessage` directly from a component.
6. Unit-test the handler. Add an E2E test if it crosses a real Chrome boundary.
7. Update the table above and in [Architecture](ARCHITECTURE.md#communication-flow).

### Compatibility

All surfaces ship in one package and update together, so there is no version skew to manage — with one
exception: **a service worker can be running an older script while a page holds an older content
script after an update**. Chrome reloads content scripts on extension update, but open tabs keep the
previous script until reloaded.

Consequences for changes:

- **Additive changes are safe.** A new message type is simply unknown to an old content script, which
  returns an `ok: false` result rather than crashing.
- **Renaming or changing a payload shape is not.** An old content script will send the old shape.
  Prefer adding a new type over changing an existing one, and treat unknown fields leniently.

---

## Part 2 — Outbound provider calls

Full detail in [AI providers](AI_PROVIDER.md). The conventions that are non-negotiable:

**Always use `postJson()`** from `src/ai/http.ts`. Calling `fetch` directly loses the timeout, the
abort chaining and the error normalisation — three things that are easy to omit and hard to notice
missing.

```ts
const data = await postJson<ChatResponse>({
  url: `${baseUrl}/chat/completions`,
  headers: { Authorization: `Bearer ${apiKey}` },
  body: { model, messages },
  signal,
});
```

| Rule | Reason |
| --- | --- |
| 30 s default timeout, overridable | An unbounded request can hang the UI indefinitely |
| Caller `AbortSignal` honoured | The popup can close mid-request |
| Every failure becomes an `AiError` with a stable code | The UI must never branch per provider |
| Provider error text truncated to 300 characters | An HTML error page must not flood the interface |
| Responses parsed through `toExplanation()` | Tolerant coercion, one place |
| **Never log the API key** | Not in a message, not in a warning, not in a thrown error |
| Only ever call the user's configured base URL | Any other host is a privacy violation |

**Never add an outbound request to a host the user did not configure.** No analytics, no telemetry, no
version check, no font CDN. This is checked in review and is the fastest way to have a change
rejected.
