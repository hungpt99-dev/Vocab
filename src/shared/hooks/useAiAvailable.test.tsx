import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { chromeMock } from '@/test/chrome-mock';
import { useAiAvailable } from './useAiAvailable';

function Harness() {
  const { available, providerName } = useAiAvailable();
  return (
    <div>
      <span data-testid="avail">{available ? 'yes' : 'no'}</span>
      <span data-testid="name">{providerName ?? ''}</span>
    </div>
  );
}

function seedSettings(providers: unknown[], activeProviderId: string): void {
  (chromeMock().storage.local.get as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (key?: string) => {
    if (key === 'avs:settings') {
      return { 'avs:settings': { providers, activeProviderId, targetLanguage: { code: 'en-US', name: 'English' } } };
    }
    return {};
  });
}

describe('useAiAvailable', () => {
  it('is unavailable when no active provider exists', async () => {
    seedSettings([], 'p1');
    await act(async () => {
      render(<Harness />);
    });
    expect(screen.getByTestId('avail').textContent).toBe('no');
  });

  it('is unavailable when the active cloud provider has no key', async () => {
    seedSettings([{ id: 'p1', type: 'openai', name: 'OpenAI', apiKey: '', enabled: true }], 'p1');
    await act(async () => {
      render(<Harness />);
    });
    expect(screen.getByTestId('avail').textContent).toBe('no');
    expect(screen.getByTestId('name').textContent).toBe('OpenAI');
  });

  it('is available when a cloud provider has a key', async () => {
    seedSettings([{ id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'sk-test', enabled: true }], 'p1');
    await act(async () => {
      render(<Harness />);
    });
    expect(screen.getByTestId('avail').textContent).toBe('yes');
  });

  it('is available for local providers that need no key', async () => {
    seedSettings([{ id: 'p1', type: 'ollama', name: 'Ollama', apiKey: '', enabled: true }], 'p1');
    await act(async () => {
      render(<Harness />);
    });
    expect(screen.getByTestId('avail').textContent).toBe('yes');
  });
});
