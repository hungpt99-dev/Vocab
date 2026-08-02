import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, SettingsRepository, SETTINGS_KEY } from './settings-repository';
import { chromeMock } from '@/test/chrome-mock';

let repo: SettingsRepository;

beforeEach(() => {
  repo = new SettingsRepository();
});

describe('get', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await repo.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges stored values over defaults', async () => {
    await chrome.storage.local.set({ [SETTINGS_KEY]: { provider: 'ollama' } });
    const settings = await repo.get();
    expect(settings.provider).toBe('ollama');
    expect(settings.highlightColor).toBe(DEFAULT_SETTINGS.highlightColor);
  });
});

describe('update', () => {
  it('performs a partial merge', async () => {
    await repo.update({ apiKey: 'sk-test' });
    const settings = await repo.update({ highlightColor: '#ff0000' });
    expect(settings.apiKey).toBe('sk-test');
    expect(settings.highlightColor).toBe('#ff0000');
  });
});

describe('reset', () => {
  it('restores defaults', async () => {
    await repo.update({ apiKey: 'sk-test' });
    expect(await repo.reset()).toEqual(DEFAULT_SETTINGS);
    expect(await repo.get()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('onChange', () => {
  it('notifies listeners for local settings changes only', () => {
    const listener = vi.fn();
    const unsubscribe = repo.onChange(listener);
    const events = chromeMock().storage.onChanged;

    events.dispatch({ [SETTINGS_KEY]: { newValue: { provider: 'gemini' } } }, 'local');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ provider: 'gemini' }));

    listener.mockClear();
    events.dispatch({ other: { newValue: 1 } }, 'local');
    events.dispatch({ [SETTINGS_KEY]: { newValue: {} } }, 'sync');
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });
});
