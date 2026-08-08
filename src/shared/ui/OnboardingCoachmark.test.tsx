import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingCoachmark } from './OnboardingCoachmark';

describe('OnboardingCoachmark', () => {
  it('shows the first step with a Next button', () => {
    render(<OnboardingCoachmark />);
    expect(screen.getByText('Getting started')).toBeTruthy();
    expect(screen.getByText(/Select any word on a page/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
  });

  it('advances through steps and dismisses, marking onboarded', async () => {
    const user = userEvent.setup();
    const setSpy = vi.fn(async () => undefined);
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: { local: { set: setSpy, get: async () => ({}) } },
    };
    render(<OnboardingCoachmark />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Save it or Explain it/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Got it/ }));
    expect(setSpy).toHaveBeenCalledWith({ 'avs:onboarded': true });
    expect(screen.queryByText('Getting started')).not.toBeInTheDocument();
  });

  it('can be dismissed immediately via the close button', async () => {
    const user = userEvent.setup();
    const setSpy = vi.fn(async () => undefined);
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: { local: { set: setSpy, get: async () => ({}) } },
    };
    render(<OnboardingCoachmark />);
    await user.click(screen.getByRole('button', { name: /Dismiss getting started/ }));
    expect(setSpy).toHaveBeenCalledWith({ 'avs:onboarded': true });
  });
});
