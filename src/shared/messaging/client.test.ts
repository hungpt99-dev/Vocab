import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression for the popup "Refresh translate" button (Bug 1): it MUST reach the
 * active tab's *content script* (where `bilingual:refresh` is handled) via
 * chrome.tabs.sendMessage — NOT chrome.runtime.sendMessage, which only reaches
 * the background worker and gets rejected as "Unhandled message type".
 */
describe('sendToActiveTab', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends to the active tab via chrome.tabs.sendMessage (not the background)', async () => {
    const tabSend = vi.fn(async () => ({ ok: true, data: undefined }));
    const runtimeSend = vi.fn();
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn(async () => [{ id: 7, active: true, currentWindow: true }]),
        sendMessage: tabSend,
      },
      runtime: { sendMessage: runtimeSend },
    });
    vi.resetModules();
    const mod = await import('./client');

    const result = await mod.sendToActiveTab({ type: 'bilingual:refresh' });

    expect(tabSend).toHaveBeenCalledTimes(1);
    expect(tabSend).toHaveBeenCalledWith(7, { type: 'bilingual:refresh' });
    expect(runtimeSend).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('returns null when no active tab is found', async () => {
    const tabSend = vi.fn();
    vi.stubGlobal('chrome', {
      tabs: { query: vi.fn(async () => []), sendMessage: tabSend },
      runtime: { sendMessage: vi.fn() },
    });
    vi.resetModules();
    const mod = await import('./client');
    const result = await mod.sendToActiveTab({ type: 'bilingual:refresh' });
    expect(result).toBeNull();
    expect(tabSend).not.toHaveBeenCalled();
  });
});
