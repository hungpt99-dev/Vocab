import { afterEach, describe, expect, it, vi } from 'vitest';
import { installSpaNavHandler } from './spa';

describe('installSpaNavHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires on history.pushState', () => {
    const onNavigate = vi.fn();
    installSpaNavHandler(onNavigate);
    history.pushState({}, '', '/new-route');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('fires on history.replaceState', () => {
    const onNavigate = vi.fn();
    installSpaNavHandler(onNavigate);
    history.replaceState({}, '', '/replaced');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('fires on popstate and hashchange', () => {
    const onNavigate = vi.fn();
    installSpaNavHandler(onNavigate);
    window.dispatchEvent(new Event('popstate'));
    window.dispatchEvent(new Event('hashchange'));
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  it('still performs the original navigation', () => {
    const onNavigate = vi.fn();
    installSpaNavHandler(onNavigate);
    history.pushState({}, '', '/deep/link');
    expect(location.pathname).toBe('/deep/link');
  });
});
