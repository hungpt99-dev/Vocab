import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';

describe('Switch', () => {
  it('reflects checked state and toggles on click', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Bilingual mode" />);

    const control = screen.getByRole('switch', { name: /Bilingual mode/ });
    expect(control).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('ignores clicks while loading', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} loading label="Bilingual mode" />);

    const control = screen.getByRole('switch', { name: /Bilingual mode/ });
    expect(control).toBeDisabled();
    await userEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });
});
