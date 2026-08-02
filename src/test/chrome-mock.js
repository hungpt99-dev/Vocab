import { vi } from 'vitest';
function createEvent() {
    const listeners = new Set();
    return {
        addListener: vi.fn((fn) => listeners.add(fn)),
        removeListener: vi.fn((fn) => listeners.delete(fn)),
        hasListener: (fn) => listeners.has(fn),
        dispatch: (...args) => listeners.forEach((fn) => fn(...args)),
        clear: () => listeners.clear(),
    };
}
export function createChromeMock() {
    const local = new Map();
    return {
        runtime: {
            id: 'test-extension-id',
            lastError: undefined,
            sendMessage: vi.fn(async () => ({ ok: true })),
            onMessage: createEvent(),
            onInstalled: createEvent(),
            openOptionsPage: vi.fn(),
            getURL: (path) => `chrome-extension://test-extension-id/${path}`,
        },
        contextMenus: {
            create: vi.fn(),
            removeAll: vi.fn((cb) => cb?.()),
            onClicked: createEvent(),
        },
        commands: { onCommand: createEvent() },
        tabs: {
            query: vi.fn(async () => [
                { id: 1, url: 'https://example.com', title: 'Example' },
            ]),
            sendMessage: vi.fn(async () => undefined),
            create: vi.fn(async () => ({ id: 2 })),
        },
        scripting: { executeScript: vi.fn(async () => [{ result: '' }]) },
        storage: {
            local: {
                get: vi.fn(async (keys) => {
                    if (keys === undefined || keys === null)
                        return Object.fromEntries(local);
                    const list = typeof keys === 'string' ? [keys] : keys;
                    return Object.fromEntries(list.filter((k) => local.has(k)).map((k) => [k, local.get(k)]));
                }),
                set: vi.fn(async (items) => {
                    Object.entries(items).forEach(([k, v]) => local.set(k, v));
                }),
                remove: vi.fn(async (key) => void local.delete(key)),
                clear: vi.fn(async () => local.clear()),
            },
            onChanged: createEvent(),
        },
    };
}
let current = createChromeMock();
export function installChromeMock() {
    current = createChromeMock();
    globalThis.chrome = current;
    return current;
}
export function resetChromeMock() {
    current = createChromeMock();
    globalThis.chrome = current;
}
export function chromeMock() {
    return current;
}
