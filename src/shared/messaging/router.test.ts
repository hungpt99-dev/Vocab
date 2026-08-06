import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerMessageHandlers, dispatch } from './router';
import type { MessageType } from './contract';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: { addListener: vi.fn() },
    },
  });
});

function fakeSender(): chrome.runtime.MessageSender {
  return { id: 'ext', url: 'https://example.com' } as chrome.runtime.MessageSender;
}

describe('registerMessageHandlers', () => {
  it('responds exactly once and never throws when the channel is already closed', async () => {
    const handlers: Record<string, unknown> = {
      ping: () => ({ pong: true }),
    };
    const sendResponse = vi.fn(() => {
      // Simulate Chrome throwing when the sender is gone.
      throw new Error('The message channel closed before a response was received');
    });

    registerMessageHandlers(handlers as never);
    const listeners = (chrome.runtime.onMessage.addListener as unknown as { mock: { calls: Array<[Function]> } }).mock.calls;
    const listener = listeners[0]![0];

    // A late/closed channel must NOT surface as an unhandled error.
    expect(() => listener({ type: 'ping' }, fakeSender(), sendResponse)).not.toThrow();
    // sendResponse is attempted once (guarded by the `settled` flag), after the
    // async dispatch resolves on a microtask.
    await Promise.resolve();
    await Promise.resolve();
    expect(sendResponse).toHaveBeenCalledTimes(1);
  });

  it('still responds once when the handler rejects', () => {
    const handlers: Record<string, unknown> = {
      boom: () => {
        throw new Error('kaboom');
      },
    };
    const sendResponse = vi.fn();
    registerMessageHandlers(handlers as never);
    const listeners = (chrome.runtime.onMessage.addListener as unknown as { mock: { calls: Array<[Function]> } }).mock.calls;
    const listener = listeners[0]![0];

    listener({ type: 'boom' }, fakeSender(), sendResponse);
    // The rejection is swallowed by dispatch and normalised into an error result.
    // It resolves on a microtask, so flush.
    return Promise.resolve().then(() => {
      expect(sendResponse).toHaveBeenCalledTimes(1);
      const [result] = sendResponse.mock.calls[0]!;
      expect(result.ok).toBe(false);
      expect(result.error).toBe('kaboom');
    });
  });
});

describe('dispatch', () => {
  it('normalises an unknown message type into a rejected result (not a throw)', async () => {
    const result = await dispatch({}, { type: 'nope' }, fakeSender());
    expect(result.ok).toBe(false);
  });

  it('routes to the matching handler and returns its data', async () => {
    const handlers = { echo: (m: { type: 'echo'; payload: { v: number } }) => ({ v: m.payload.v }) };
    const result = await dispatch(handlers as never, { type: 'echo', payload: { v: 7 } }, fakeSender());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ v: 7 });
  });
});

void (null as unknown as MessageType);
