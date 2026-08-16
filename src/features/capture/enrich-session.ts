import type { ExplainKind } from '@/shared/types/ai';
import type { Explanation } from '@/shared/types/vocabulary';

/**
 * Durable in-flight state for the popup's AI enrich action. The popup can close
 * and reopen mid-call (it remounts on blur), which wipes volatile React state
 * and makes the loading spinner vanish. We mirror the enrich session in storage
 * so a reloaded popup can still pick up the result.
 *
 * The session is SET by the popup (before the AI round-trip) but is only ever
 * SETTLED by the background worker (see `settleEnrichSession`): the worker is
 * the one context guaranteed to run to completion even when the popup dies
 * mid-call, so a stored `enriching: true` can never outlive the request it
 * describes.
 */
export const ENRICH_SESSION_KEY = 'avs:enrich-session';

export interface EnrichSession {
  word: string;
  kind: ExplainKind | null;
  enriching: boolean;
  explanation: Explanation | null;
}

export async function readEnrichSession(): Promise<EnrichSession | null> {
  const result = await chrome.storage.local.get(ENRICH_SESSION_KEY);
  return (result[ENRICH_SESSION_KEY] as EnrichSession | undefined) ?? null;
}

export function writeEnrichSession(s: EnrichSession | null): void {
  if (s) chrome.storage.local.set({ [ENRICH_SESSION_KEY]: s });
  else chrome.storage.local.remove(ENRICH_SESSION_KEY);
}

/**
 * Mirror an explain outcome into the durable enrich session, when one exists
 * for this word. Called from the background worker after the AI call settles
 * (success or failure) so a popup that closed mid-call never resumes a phantom
 * "enriching" session — the result is delivered the moment the popup is
 * reopened, and a failed call cannot leave the spinner stuck either.
 */
export async function settleEnrichSession(
  word: string,
  explanation: Explanation | null,
): Promise<void> {
  const session = await readEnrichSession();
  if (!session || session.word.toLowerCase() !== word.toLowerCase()) return;
  if (explanation) {
    writeEnrichSession({ word: session.word, kind: session.kind, enriching: false, explanation });
  } else {
    writeEnrichSession(null);
  }
}