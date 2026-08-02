/**
 * Dispatch an incoming message to its handler, normalising every outcome into
 * a `MessageResult`. Unknown message types are rejected rather than thrown.
 */
export async function dispatch(handlers, message, sender) {
    if (!isMessage(message)) {
        return { ok: false, error: 'Malformed message.' };
    }
    const handler = handlers[message.type];
    if (!handler) {
        return { ok: false, error: `Unhandled message type: ${message.type}` };
    }
    try {
        const data = await handler(message, sender);
        return { ok: true, data };
    }
    catch (error) {
        const like = error;
        return {
            ok: false,
            error: typeof like?.message === 'string' ? like.message : 'Unexpected error.',
            ...(typeof like?.code === 'string' ? { code: like.code } : {}),
        };
    }
}
function isMessage(value) {
    return (typeof value === 'object' &&
        value !== null &&
        typeof value.type === 'string');
}
/**
 * Register a handler map on `chrome.runtime.onMessage`.
 * Returns true synchronously so Chrome keeps the response channel open.
 */
export function registerMessageHandlers(handlers) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        void dispatch(handlers, message, sender).then(sendResponse);
        return true;
    });
}
