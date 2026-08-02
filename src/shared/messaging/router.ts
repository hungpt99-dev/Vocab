import type { Message, MessageResult, MessageType, ResponseMap } from './contract';

export type Handler<T extends MessageType> = (
  payload: Extract<Message, { type: T }>,
  sender: chrome.runtime.MessageSender,
) => Promise<ResponseMap[T]> | ResponseMap[T];

export type HandlerMap = { [T in MessageType]?: Handler<T> };

interface ErrorLike {
  message?: unknown;
  code?: unknown;
}

/**
 * Dispatch an incoming message to its handler, normalising every outcome into
 * a `MessageResult`. Unknown message types are rejected rather than thrown.
 */
export async function dispatch(
  handlers: HandlerMap,
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResult<MessageType>> {
  if (!isMessage(message)) {
    return { ok: false, error: 'Malformed message.' };
  }

  const handler = handlers[message.type] as Handler<MessageType> | undefined;
  if (!handler) {
    return { ok: false, error: `Unhandled message type: ${message.type}` };
  }

  try {
    const data = await handler(message as never, sender);
    return { ok: true, data };
  } catch (error) {
    const like = error as ErrorLike;
    return {
      ok: false,
      error: typeof like?.message === 'string' ? like.message : 'Unexpected error.',
      ...(typeof like?.code === 'string' ? { code: like.code } : {}),
    };
  }
}

function isMessage(value: unknown): value is Message {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/**
 * Register a handler map on `chrome.runtime.onMessage`.
 * Returns true synchronously so Chrome keeps the response channel open.
 */
export function registerMessageHandlers(handlers: HandlerMap): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void dispatch(handlers, message, sender).then(sendResponse);
    return true;
  });
}
