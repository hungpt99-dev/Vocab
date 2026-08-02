/** Send a message to the service worker and unwrap the typed result. */
export async function sendMessage(message) {
    const result = (await chrome.runtime.sendMessage(message));
    if (!result) {
        throw new Error('No response from the extension background worker.');
    }
    if (!result.ok) {
        throw new Error(result.error);
    }
    return result.data;
}
/** Send a message to a specific tab, swallowing "no receiver" errors. */
export async function sendToTab(tabId, message) {
    try {
        const result = (await chrome.tabs.sendMessage(tabId, message));
        if (!result || !result.ok)
            return null;
        return result.data;
    }
    catch {
        // The tab has no content script (chrome:// pages, PDF viewer, etc.).
        return null;
    }
}
/** Broadcast a message to every tab that has a content script. */
export async function broadcast(message) {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.filter((tab) => typeof tab.id === 'number').map((tab) => sendToTab(tab.id, message)));
}
