import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PopupSettings } from './PopupSettings';
import { DEFAULT_SETTINGS } from '@/storage/settings-repository';

describe('PopupSettings', () => {
  it('toggles auto-translate and simplify, and changes the default tab', async () => {
    const onChange = vi.fn();
    render(<PopupSettings settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const translate = screen.getByLabelText(/auto-translate/i) as HTMLInputElement;
    await userEvent.click(translate);
    expect(onChange).toHaveBeenCalledWith({ popupShowTranslation: false });

    const simplify = screen.getByLabelText(/simplify action/i) as HTMLInputElement;
    await userEvent.click(simplify);
    expect(onChange).toHaveBeenCalledWith({ popupShowSimplify: false });

    const tab = screen.getByLabelText(/default tab/i) as HTMLSelectElement;
    await userEvent.selectOptions(tab, 'review');
    expect(onChange).toHaveBeenCalledWith({ popupDefaultTab: 'review' });
  });
});
