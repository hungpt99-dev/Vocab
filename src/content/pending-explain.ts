/** Short-lived hand-off of a word the user asked to explain from the page
 * toolbar, so the popup can become the single explain surface. Consumed once. */
const PENDING_KEY = 'avs:pending-explain';

export interface PendingExplain {
  word: string;
  context?: string;
  kind?: string;
}

export async function setPendingExplain(value: PendingExplain): Promise<void> {
  await chrome.storage.local.set({ [PENDING_KEY]: value });
}

export async function takePendingExplain(): Promise<PendingExplain | null> {
  const result = await chrome.storage.local.get(PENDING_KEY);
  const value = (result[PENDING_KEY] as PendingExplain | undefined) ?? null;
  if (value) await chrome.storage.local.remove(PENDING_KEY);
  return value;
}
