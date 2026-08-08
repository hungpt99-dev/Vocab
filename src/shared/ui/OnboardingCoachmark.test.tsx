import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingCoachmark } from './OnboardingCoachmark';

function mockChrome(setSpy: ReturnType<typeof vi.fn>): void {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: { set: setSpy, get: async () => ({}) } },
  };
}

describe('OnboardingCoachmark', () => {
  it('shows the first step with a Next button', () => {
    render(<OnboardingCoachmark />);
    expect(screen.getByText('Getting started')).toBeTruthy();
    expect(screen.getByText(/Select any word on a page/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
  });

  it('advances through steps and finishes on the final CTA', async () => {
    const user = userEvent.setup();
    const setSpy = vi.fn(async () => undefined);
    mockChrome(setSpy);
    const onStartSaving = vi.fn();
    render(<OnboardingCoachmark onStartSaving={onStartSaving} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Save it or Explain it/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Save your first word/ }));
    expect(setSpy).toHaveBeenCalledWith({ 'avs:onboarded': true });
    expect(onStartSaving).toHaveBeenCalled();
    expect(screen.queryByText('Getting started')).not.toBeInTheDocument();
  });

  it('can be dismissed immediately via the close button', async () => {
    const user = userEvent.setup();
    const setSpy = vi.fn(async () => undefined);
    mockChrome(setSpy);
    render(<OnboardingCoachmark />);
    await user.click(screen.getByRole('button', { name: /Dismiss getting started/ }));
    expect(setSpy).toHaveBeenCalledWith({ 'avs:onboarded': true });
  });
});
