import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isOnboarded, markOnboarded } from './onboarding';

type LocalStore = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (value: Record<string, unknown>) => Promise<void>;
};

function setChromeLocal(store: Record<string, unknown>): LocalStore {
  const local: LocalStore = {
    get: async (key: string) => ({ [key]: store[key] }),
    set: async (value: Record<string, unknown>) => {
      Object.assign(store, value);
    },
  };
  (globalThis as unknown as { chrome: unknown }).chrome = { storage: { local } };
  return local;
}

describe('onboarding flag', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reports not onboarded by default', async () => {
    const store: Record<string, unknown> = {};
    setChromeLocal(store);
    expect(await isOnboarded()).toBe(false);
  });

  it('reports onboarded when the flag is set', async () => {
    const store: Record<string, unknown> = { 'avs:onboarded': true };
    setChromeLocal(store);
    expect(await isOnboarded()).toBe(true);
  });

  it('marks onboarded', async () => {
    const store: Record<string, unknown> = {};
    const setMock = vi.fn(async (value: Record<string, unknown>) => {
      Object.assign(store, value);
    });
    const local = setChromeLocal(store);
    local.set = setMock;
    await markOnboarded();
    expect(setMock).toHaveBeenCalledWith({ 'avs:onboarded': true });
  });
});
