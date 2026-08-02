# AI Providers

How the extension talks to AI models, why the abstraction exists, and how to add a provider.

Source: `src/ai/`. Related: [Architecture](ARCHITECTURE.md#ai-provider-abstraction),
[System design](SYSTEM_DESIGN.md#6-ai-request-pipeline),
[ADR-003](DECISION_LOG.md#adr-003--one-adapter-for-openai-compatible-providers)–[005](DECISION_LOG.md#adr-005--tolerant-parsing-of-ai-responses).

---

## The abstraction

Every provider implements one interface (`src/ai/types.ts`):

```ts
export interface AiProvider {
  readonly id: AiProviderId;
  readonly label: string;
  readonly defaultModel: string;
  readonly defaultBaseUrl: string;
  /** Whether this provider requires an API key (local runtimes do not). */
  readonly requiresApiKey: boolean;
  explain(request: ExplainRequest, config: ProviderConfig): Promise<Explanation>;
}
```

```ts
export interface ExplainRequest {
  word: string;
  context?: string;   // sentence the word appeared in, to disambiguate sense
  language?: string;
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}
```

**The rule that matters: application logic must never branch on which provider is active.** Anything
provider-specific belongs behind this interface. If you find yourself writing
`if (settings.provider === 'gemini')` outside `src/ai/providers/`, the abstraction is being violated.

---

## Supported providers

| Provider | Id | Key required | Default model | Adapter |
| --- | --- | --- | --- | --- |
| OpenAI | `openai` | yes | `gpt-4o-mini` | `OpenAiCompatibleProvider` |
| OpenRouter | `openrouter` | yes | `openai/gpt-4o-mini` | `OpenAiCompatibleProvider` |
| Ollama | `ollama` | no | `llama3.1` | `OpenAiCompatibleProvider` |
| LM Studio | `lmstudio` | no | `local-model` | `OpenAiCompatibleProvider` |
| Google Gemini | `gemini` | yes | `gemini-1.5-flash` | `GeminiProvider` |
| Anthropic | `anthropic` | yes | `claude-3-5-haiku-latest` | `AnthropicProvider` |

Four of the six share one adapter because they speak an identical chat-completions dialect. They are
distinguished only by a **preset** — id, label, base URL, default model, and whether a key is needed.
Gemini and Anthropic have genuinely different wire formats and get their own adapters.

The registry (`src/ai/registry.ts`) builds the lookup at module load:

```ts
for (const preset of OPENAI_COMPATIBLE_PRESETS) {
  providers.set(preset.id, new OpenAiCompatibleProvider(preset));
}
providers.set('gemini', new GeminiProvider());
providers.set('anthropic', new AnthropicProvider());
```

`getProvider()` throws `AiError('unknown_provider')` for an unregistered id. `registry.test.ts`
asserts that every id in `AI_PROVIDER_IDS` resolves, so declaring a provider without registering it
fails the suite.

---

## Request flow

```
ExplainService.explain(word, context)
  │
  ├─ settingsRepository.get()              provider, apiKey, model, baseUrl
  ├─ registry.getProvider(id)              → AiError('unknown_provider') if absent
  ├─ guard: requiresApiKey && !apiKey      → AiError('missing_api_key')   no network call
  ├─ buildPrompt(word, context)            src/ai/prompt.ts
  ├─ provider.explain(request, config)
  │     └─ postJson()                      src/ai/http.ts
  │           ├─ 30 s timeout via AbortController
  │           ├─ caller's signal chained in
  │           └─ non-2xx → statusToCode() → AiError
  ├─ parse.toExplanation()                 tolerant coercion
  └─ cached onto the entry                 IndexedDB
```

The missing-key guard runs **before** any network call, so a misconfigured provider fails instantly
and cannot leak a request.

Configuration falls back per field: a blank `model` or `baseUrl` uses the provider's default, so users
only set what they want to override.

---

## Timeouts and cancellation

`postJson()` in `src/ai/http.ts` owns both:

| Mechanism | Behaviour |
| --- | --- |
| Timeout | 30 s default (`DEFAULT_TIMEOUT_MS`), overridable per request via `timeoutMs`. Aborts with `AiError('timeout')`. |
| Caller cancellation | The caller's `AbortSignal` is chained into an internal `AbortController`; aborts with `AiError('aborted')`. |
| Cleanup | The timer is cleared and the abort listener removed in `finally`, on every path. |

Cancellation matters because the popup can close mid-request. An aborted request never writes a
partial entry.

---

## Retry policy

**Implemented.** Transient failures retry automatically with exponential backoff and jitter, up to
three attempts. See `src/ai/retry.ts` and `src/ai/explain-service.ts`.

Only transient errors are retried — replaying an auth, key, format or unknown-provider failure would
only waste the user's quota:

| Code | Retried? | Reason |
| --- | --- | --- |
| `rate_limited`, `server_error`, `network`, `timeout` | **Yes** | Transient; a replay may succeed |
| `unauthorized`, `missing_api_key`, `bad_response`, `unknown_provider` | No | Permanent; retrying is futile |

Behaviour:

- Backoff is `500ms × 2^attempt` plus up to 25% jitter, capped at 10 s.
- Aborting (e.g. closing the popup) fails immediately and never schedules a retry.
- The abort signal is honoured *during* the backoff delay, not only between attempts.
- Non-`AiError` rejections are normalised to `network` before classification, so a fetch failure is
  retried like any other transient error.

Covered by `src/ai/resilience.test.ts`.

## Rate limiting

**Implemented.** All AI calls share one token-bucket limiter (5 requests / 10 s) in
`src/ai/rate-limiter.ts`, so concurrent requests — for example auto-explain firing on several saves at
once — do not burst the provider. The limiter pauses rather than drops a request, because the extension
is user-driven and a short wait beats a lost call. If a provider still returns `rate_limited` after the
retries, that error surfaces to the user as a clear message.

## Streaming

**Not implemented.** Explanations arrive in one response.

The interface returns `Promise<Explanation>`, so adding streaming means extending `AiProvider` with an
optional streaming method that adapters opt into, leaving non-streaming providers unchanged. The UI
would render tokens as they arrive to cut perceived latency. Listed as a v0.2 candidate in
[Roadmap](ROADMAP.md).

---

## Error handling

Every failure becomes an `AiError` carrying a stable code:

```ts
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly status?: number,
  ) { super(message); this.name = 'AiError'; }
}
```

| Code | Cause | What the user should do |
| --- | --- | --- |
| `missing_api_key` | Provider needs a key; none configured | Add a key, or switch to Ollama / LM Studio |
| `unauthorized` | HTTP 401 or 403 | Check the key is valid and has model access |
| `rate_limited` | HTTP 429 | Wait, or change model |
| `server_error` | HTTP ≥ 500 | Provider-side; retry later |
| `network` | Other non-2xx, DNS or connection failure | Check connectivity, or that the local model is running |
| `timeout` | Exceeded `timeoutMs` | Retry, or pick a faster model |
| `aborted` | Caller cancelled (e.g. popup closed) | None; expected |
| `bad_response` | Response contained no usable meaning | Retry, or switch model |
| `unknown_provider` | Id not in the registry | Programming error |

Status mapping lives in `statusToCode()` and is intentionally coarse — codes are effectively public
API for the UI, so **add codes rather than renaming them**.

The provider's own error text is appended, truncated to 300 characters so an HTML error page cannot
flood the interface.

---

## Response parsing

Models return prose preambles, fenced code blocks, and inconsistent field types even when the prompt
demands strict JSON. `src/ai/parse.ts` is tolerant by design:

1. Strip markdown code fences.
2. Extract the outermost `{ … }` object.
3. Coerce scalars into arrays where a list is expected.
4. Drop non-string members from string arrays.
5. Fall back `simpleExplanation → meaning` when one is missing.
6. Fail with `bad_response` **only** when no usable meaning exists.

The resulting `Explanation` (`src/shared/types/vocabulary.ts`):

| Field | Type | Notes |
| --- | --- | --- |
| `meaning` | `string` | The only genuinely required field |
| `simpleExplanation` | `string` | Plain-language restatement |
| `examples` | `string[]` | |
| `synonyms` | `string[]` | |
| `pronunciation` | `string` | IPA where the model provides it |
| `collocations` | `string[]` | |
| `provider` | `string` | Which provider generated it |
| `model` | `string` | Model id, when reported |
| `generatedAt` | `number` | Epoch milliseconds |

`provider`, `model` and `generatedAt` are recorded so a cached explanation can be attributed and
invalidated later.

The trade-off — a malformed field is dropped silently rather than surfaced — is accepted because the
alternative is showing a parse error for an otherwise good answer. See
[ADR-005](DECISION_LOG.md#adr-005--tolerant-parsing-of-ai-responses).

---

## Adding a provider

### Case 1 — it speaks the OpenAI chat-completions dialect

A data change. No new class.

1. Add the id to `AiProviderId` in `src/shared/types/settings.ts`.
2. Add a preset to `OPENAI_COMPATIBLE_PRESETS` in `src/ai/providers/openai-compatible.ts`:

```ts
{
  id: 'together',
  label: 'Together AI',
  defaultBaseUrl: 'https://api.together.xyz/v1',
  defaultModel: 'meta-llama/Llama-3-8b-chat-hf',
  requiresApiKey: true,
}
```

3. Run `npm run test`. `registry.test.ts` verifies the id resolves.
4. Update the table in this document and in the [README](../README.md#ai-providers).

### Case 2 — it has a different wire format

1. Create `src/ai/providers/<name>.ts` implementing `AiProvider`.
2. Use `postJson()` from `src/ai/http.ts` — do not call `fetch` directly, or you lose timeout, abort
   and error normalisation.
3. Map the response through `toExplanation()` rather than hand-parsing.
4. Register it in `src/ai/registry.ts`.
5. Add the id to `AiProviderId`.
6. Write adapter tests with a mocked `fetch`, covering success, a 401, and a malformed body.
7. Update this document, the [README](../README.md#ai-providers) and
   [CHANGELOG](CHANGELOG.md).

### Checklist

- [ ] No provider-specific branching leaked outside `src/ai/providers/`
- [ ] All errors raised as `AiError` with an existing code
- [ ] Timeout and abort honoured (i.e. `postJson` used)
- [ ] The API key never logged, never included in an error message
- [ ] Tests cover success, auth failure and malformed response
- [ ] Documentation updated in the same commit
