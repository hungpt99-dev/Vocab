import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function installChromeStorage(initial: Record<string, unknown>): void {
  const data: Record<string, unknown> = { ...initial };
  const listeners: Array<(c: Record<string, { newValue?: unknown }>, a: string) => void> = [];
  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string | string[]) => {
          const keys = Array.isArray(key) ? key : [key];
          const out: Record<string, unknown> = {};
          for (const k of keys) if (k in data) out[k] = data[k];
          return out;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(data, items);
          const changes: Record<string, { newValue?: unknown }> = {};
          for (const k of Object.keys(items)) changes[k] = { newValue: items[k] };
          for (const l of listeners) l(changes, 'local');
        }),
        onChanged: { addListener: vi.fn((cb: (c: Record<string, { newValue?: unknown }>, a: string) => void) => listeners.push(cb)) },
      },
    },
  };
}

function clearChrome(): void {
  // Force a fresh module so the onChanged listener + cache re-init.
  delete (globalThis as Record<string, unknown>).chrome;
  vi.resetModules();
}

describe('bilingualLog gating', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    clearChrome();
  });

  it('logs nothing when the chrome.storage flag is unset', async () => {
    installChromeStorage({});
    const mod = await import('./bilingual-log');
    mod.bilingualLog.content('should-not-appear');
    // allow the async gate to resolve
    await new Promise((r) => setTimeout(r, 5));
    expect(console.log).not.toHaveBeenCalled();
  });

  it('logs on the content side once the shared chrome.storage flag is set', async () => {
    installChromeStorage({ 'avs:debug-bilingual': true });
    const mod = await import('./bilingual-log');
    mod.bilingualLog.content('hello', { a: 1 });
    await new Promise((r) => setTimeout(r, 5));
    expect(console.log).toHaveBeenCalledWith('[avs:bilingual][content]', 'hello', { a: 1 });
  });

  it('logs on the sw side with the same shared flag', async () => {
    installChromeStorage({ 'avs:debug-bilingual': true });
    const mod = await import('./bilingual-log');
    mod.bilingualLog.sw('sw-line');
    await new Promise((r) => setTimeout(r, 5));
    expect(console.log).toHaveBeenCalledWith('[avs:bilingual][sw]', 'sw-line');
  });
});
