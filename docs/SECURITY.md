# Security

The extension's security posture, what it protects, and — importantly — what it does not.

Related: [Storage](STORAGE.md), [AI providers](AI_PROVIDER.md),
[ADR-001](DECISION_LOG.md#adr-001--local-first-with-no-backend).

---

## Summary

The attack surface is small by construction. There is no backend, no account system, no telemetry and
no third-party script. The extension stores data locally and makes exactly two kinds of outbound
request: a translation the user's reading features make to Google's keyless Translate endpoint, and
an AI call the user triggered, sent directly to the provider they configured. Both are documented in
[Data flows](#data-flows).

The main residual risk is that the user's API key is stored in browser-local storage, where anything
with access to the browser profile can read it. This is inherent to bring-your-own-key extensions and
is disclosed rather than hidden.

---

## Permission model

Declared in `scripts/manifest.ts`. Each permission is requested for one reason:

| Permission | Why it is needed | What would break without it |
| --- | --- | --- |
| `storage` | Persist settings in `chrome.storage.local` and receive change events | No settings; no live updates to open tabs |
| `contextMenus` | The "Save … to vocabulary" right-click entry | Context-menu capture |
| `activeTab` | Read the selection from the tab the user acted on | Capture from menu and shortcut |
| `unlimitedStorage` | Avoid a quota ceiling on a growing vocabulary | Large libraries could hit the default quota |
| `host_permissions: <all_urls>` | Highlighting must work on any page the user reads | Highlighting would be limited to an allow-list |

`<all_urls>` is the broadest request here and will be questioned in Chrome Web Store review. The
honest justification: the product's value is that saved words are highlighted **wherever** the user
reads, which cannot be predicted in advance. The extension reads page text to find matches and writes
only its own `<mark>` and overlay elements. It does not exfiltrate page content — see
[Data flows](#data-flows).

A narrower alternative — per-site opt-in — is on the roadmap as *per-site highlight control*, which
would let cautious users restrict where the script runs.

**Rule: never add a permission without justifying it in this table.**

---

## API key handling

| Aspect | Behaviour |
| --- | --- |
| Where it is stored | `chrome.storage.local`, inside `avs:settings` |
| Who can read it | Any code running in the extension's own context, and anyone with access to the browser profile on disk |
| Where it is sent | Only to the provider base URL the user configured, over HTTPS |
| In the UI | The input is `type="password"` |
| In logs | Never. No key is logged, echoed into an error message, or included in a bug report |
| In exports | **Not included.** A backup file carrying a live credential would be a disclosure risk each time it was shared |
| In the repository | Never committed. Test fixtures use obvious placeholders |

**Honest limitation.** `chrome.storage.local` is not encrypted. A user with local access, another
extension with sufficient permissions, or anyone reading the profile directory can recover the key.
Chrome offers no secret storage that would change this for an extension holding a credential it must
send. Mitigations available to the user: scope the key narrowly at the provider, set a spending cap,
rotate it periodically, or use a local model (Ollama, LM Studio) that needs no key at all.

---

## Data flows

Every outbound byte, exhaustively:

| Flow | Trigger | Destination | Contains |
| --- | --- | --- | --- |
| Bilingual reading | Reader is open on a page (per settings or command) | `translate.googleapis.com` | Article sentences, paragraphs and individual words from the *current page*, plus the target language |
| Quick translation | Selection card open, or popup translation on save/open | `translate.googleapis.com` | The selected or saved word (and its sentence, for context) |
| AI explanation | User clicks *AI explain*, or auto-explain is enabled | The provider base URL in settings | The word and its sentence context |
| AI translation fallback | No configured provider has a working key | `translate.googleapis.com` | The same word/sentence the AI call would have sent |
| Connection test | User clicks *Test connection* | The provider base URL in settings | A minimal probe request |

Bilingual reading and quick translation do not use the user's AI key — they are
served by Google's public, keyless Translate endpoint (the same one the Google
Translate widget uses). This is what makes the reading features work out of the
box. Details of what is sent, and how to turn the flow off, are in
[Privacy](PRIVACY.md#what-is-sent-where).

There is no other network activity. No analytics, no crash reporting, no update
pings beyond Chrome's own extension updates, no fonts or scripts loaded from a
CDN.

**What never leaves the browser:** the vocabulary library, notes, tags, browsing
history, URLs of pages visited, and the API key itself (it is sent *to* the
provider as a credential, never to anyone else).

---

## Input validation

Three untrusted inputs, each handled at its boundary:

**Page content.** Treated as hostile. The highlighter never uses `innerHTML`; it creates elements and
sets `textContent`, so page text cannot become markup. The walker skips `<script>`, `<style>`, inputs
and contenteditable regions.

**Model output.** Also untrusted — a model can be prompted into returning anything. `parse.ts`
validates and coerces the response into the `Explanation` shape, and rendering uses React's default
escaping. No model output is ever interpreted as HTML.

**Backup files.** `parseBackup()` validates the object shape, the `entries` array, the
`schemaVersion`, and every entry, rejecting the whole file before any write. See
[Storage](STORAGE.md#validation).

**Saved words as regex.** Every vocabulary key is passed through `escapeRegExp` before being compiled
into the matcher, so a word containing regex metacharacters cannot corrupt the pattern or cause
catastrophic backtracking.

---

## Threat model

| Threat | Likelihood | Mitigation | Residual risk |
| --- | --- | --- | --- |
| API key stolen from local storage | Low–medium | Not exported, not logged, masked in UI | **Accepted.** Inherent to BYO-key; disclosed to users |
| Malicious page injects script via highlighting | Low | No `innerHTML`; nodes built programmatically | Minimal |
| Malicious model output rendered as HTML | Low | React escaping; validated parsing | Minimal |
| Malicious import file | Low | Whole-file validation before any write | Minimal |
| Regex denial of service via a crafted saved word | Very low | All keys escaped; user supplies their own words | Minimal |
| Another extension reads our storage | Low | Chrome isolates extension storage; no cross-extension messaging exposed | Requires an already-compromised browser |
| Supply-chain compromise of a dependency | Medium | Lockfile committed; Dependabot enabled; small dependency set | **Ongoing.** Review dependency updates |
| User exfiltrates their own data | n/a | Not a threat — the export feature exists for this | — |
| Man-in-the-middle on a provider call | Very low | HTTPS to hosted providers | Local providers over plain HTTP on `localhost` are not exposed to a network MITM |
| Page content sent to a provider without consent | Low | Only the selected word and its sentence are sent, and only on an explicit action | Auto-explain sends on save; it is off by default |
| Page content sent to Google Translate while reading | Medium (feature is enabled by default) | Bilingual reading sends *current page* sentences/words to Google's keyless endpoint — disclosed, off-by-command or by setting, and never stored | A user who needs zero outbound traffic must turn the reader off |

---

## Secure coding practices

Enforced or reviewed on every change:

- **No `innerHTML`** with page-derived or model-derived content. Build nodes; set `textContent`.
- **No secrets in logs.** `no-console` permits only `warn` and `error`, and neither may carry a key.
- **No new permission** without an entry in the table above.
- **No new outbound request** to any host other than the user's configured provider.
- **No `any`** — `@typescript-eslint/no-explicit-any` is an error. Untyped data must be narrowed from
  `unknown`, which forces validation at boundaries.
- **Dependencies stay few and boring.** Every addition is a supply-chain risk; question anything that
  runs a postinstall script or phones home.
- **Lockfile is committed** and CI installs with `npm ci`, so builds are reproducible.

---

## Reporting a vulnerability

Open a GitHub issue for low-severity findings. For anything that could expose user credentials or
data, contact the maintainers privately rather than filing publicly, and allow time for a fix before
disclosure.

Please include: the version, the affected surface, reproduction steps, and the impact. **Redact your
API key** from any log or screenshot.
