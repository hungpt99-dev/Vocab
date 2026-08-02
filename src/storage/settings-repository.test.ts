import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, SettingsRepository, SETTINGS_KEY } from './settings-repository';
import { chromeMock } from '@/test/chrome-mock';

let repo: SettingsRepository;

beforeEach(() => {
  repo = new SettingsRepository();
});

describe('get', () => {
  it('returns defaults with one active provider when nothing is stored', async () => {
    const settings = await repo.get();
    expect(settings.providers).toHaveLength(1);
    expect(settings.activeProviderId).toBe(settings.providers[0]!.id);
    expect(settings.providers[0]!.type).toBe('openai');
  });

  it('merges stored values over defaults', async () => {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: {
        providers: [{ id: 'p1', type: 'gemini', name: 'Gem', apiKey: '', baseUrl: '', model: '', enabled: true }],
        activeProviderId: 'p1',
      },
    });
    const settings = await repo.get();
    expect(settings.providers[0]!.type).toBe('gemini');
    expect(settings.highlightColor).toBe(DEFAULT_SETTINGS.highlightColor);
  });

  it('migrates legacy single-provider settings forward', async () => {
    await chrome.storage.local.set({ [SETTINGS_KEY]: { provider: 'ollama', apiKey: 'sk-old' } });
    const settings = await repo.get();
    expect(settings.providers[0]!.type).toBe('ollama');
    expect(settings.providers[0]!.apiKey).toBe('sk-old');
    expect(settings.activeProviderId).toBe('prov_default');
  });
});

describe('update', () => {
  it('performs a partial merge', async () => {
    await repo.update({ providers: [{ id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'sk-test', baseUrl: '', model: '', enabled: true }] });
    const settings = await repo.update({ highlightColor: '#ff0000' });
    expect(settings.providers[0]!.apiKey).toBe('sk-test');
    expect(settings.highlightColor).toBe('#ff0000');
  });
});

describe('reset', () => {
  it('restores defaults', async () => {
    await repo.update({
      providers: [{ id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'sk-test', baseUrl: '', model: '', enabled: true }],
    });
    expect(await repo.reset()).toEqual(DEFAULT_SETTINGS);
    expect(await repo.get()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('onChange', () => {
  it('notifies listeners for local settings changes only', () => {
    const listener = vi.fn();
    const unsubscribe = repo.onChange(listener);
    const events = chromeMock().storage.onChanged;

    events.dispatch(
      {
        [SETTINGS_KEY]: {
          newValue: {
            providers: [{ id: 'p1', type: 'gemini', name: 'Gem', apiKey: '', baseUrl: '', model: '', enabled: true }],
            activeProviderId: 'p1',
          },
        },
      },
      'local',
    );
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ activeProviderId: 'p1' }));

    listener.mockClear();
    events.dispatch({ other: { newValue: 1 } }, 'local');
    events.dispatch({ [SETTINGS_KEY]: { newValue: {} } }, 'sync');
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });
});
