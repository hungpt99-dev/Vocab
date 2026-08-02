/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';

type Listener = (...args: any[]) => void;

function createEvent() {
  const listeners = new Set<Listener>();
  return {
    addListener: vi.fn((fn: Listener) => listeners.add(fn)),
    removeListener: vi.fn((fn: Listener) => listeners.delete(fn)),
    hasListener: (fn: Listener) => listeners.has(fn),
    dispatch: (...args: any[]) => listeners.forEach((fn) => fn(...args)),
    clear: () => listeners.clear(),
  };
}

export function createChromeMock() {
  const local = new Map<string, unknown>();
  return {
    runtime: {
      id: 'test-extension-id',
      lastError: undefined as chrome.runtime.LastError | undefined,
      sendMessage: vi.fn(async () => ({ ok: true })),
      onMessage: createEvent(),
      onInstalled: createEvent(),
      openOptionsPage: vi.fn(),
      getURL: (path: string) => `chrome-extension://test-extension-id/${path}`,
    },
    contextMenus: {
      create: vi.fn(),
      removeAll: vi.fn((cb?: () => void) => cb?.()),
      onClicked: createEvent(),
    },
    commands: { onCommand: createEvent() },
    tabs: {
      query: vi.fn<(...args: any[]) => Promise<any>>(async () => [
        { id: 1, url: 'https://example.com', title: 'Example' },
      ]),
      sendMessage: vi.fn<(...args: any[]) => Promise<any>>(async () => undefined),
      create: vi.fn<(...args: any[]) => Promise<any>>(async () => ({ id: 2 })),
    },
    scripting: { executeScript: vi.fn(async () => [{ result: '' }]) },
    storage: {
      local: {
        get: vi.fn(async (keys?: string | string[] | null) => {
          if (keys === undefined || keys === null) return Object.fromEntries(local);
          const list = typeof keys === 'string' ? [keys] : keys;
          return Object.fromEntries(list.filter((k) => local.has(k)).map((k) => [k, local.get(k)]));
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.entries(items).forEach(([k, v]) => local.set(k, v));
        }),
        remove: vi.fn(async (key: string) => void local.delete(key)),
        clear: vi.fn(async () => local.clear()),
      },
      onChanged: createEvent(),
    },
  };
}

let current = createChromeMock();

export function installChromeMock() {
  current = createChromeMock();
  (globalThis as any).chrome = current;
  return current;
}

export function resetChromeMock() {
  current = createChromeMock();
  (globalThis as any).chrome = current;
}

export function chromeMock() {
  return current;
}
