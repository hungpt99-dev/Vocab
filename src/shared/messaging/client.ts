import type { Message, MessageResult, MessageType, ResponseMap } from './contract';

/** Send a message to the service worker and unwrap the typed result. */
export async function sendMessage<T extends MessageType>(
  message: Extract<Message, { type: T }>,
): Promise<ResponseMap[T]> {
  const result = (await chrome.runtime.sendMessage(message)) as MessageResult<T> | undefined;
  if (!result) {
    throw new Error('No response from the extension background worker.');
  }
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

/** Send a message to a specific tab, swallowing "no receiver" errors. */
export async function sendToTab<T extends MessageType>(
  tabId: number,
  message: Extract<Message, { type: T }>,
): Promise<ResponseMap[T] | null> {
  try {
    const result = (await chrome.tabs.sendMessage(tabId, message)) as MessageResult<T> | undefined;
    if (!result || !result.ok) return null;
    return result.data;
  } catch {
    // The tab has no content script (chrome:// pages, PDF viewer, etc.).
    return null;
  }
}

/** Broadcast a message to every tab that has a content script. */
export async function broadcast(message: Message): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.filter((tab) => typeof tab.id === 'number').map((tab) => sendToTab(tab.id!, message)),
  );
}

/**
 * Send a message to the active tab's content script (NOT the service worker).
 * Use this for messages whose handler lives in the content script (e.g.
 * `bilingual:refresh`, `bilingual:reconcile`) — `sendMessage` only reaches the
 * background worker, where such handlers are not registered, and would be
 * rejected as "Unhandled message type".
 */
export async function sendToActiveTab<T extends MessageType>(
  message: Extract<Message, { type: T }>,
): Promise<ResponseMap[T] | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (typeof tab?.id !== 'number') return null;
  return sendToTab(tab.id, message);
}
