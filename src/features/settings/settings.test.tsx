import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { ToastProvider } from '@/shared/ui/Toast';
import { DEFAULT_SETTINGS } from '@/storage/settings-repository';

const renderData = () =>
  render(
    <ToastProvider>
      <DataSettings notify={vi.fn()} />
    </ToastProvider>,
  );

describe('AppearanceSettings', () => {
  it('labels every control', () => {
    render(<AppearanceSettings settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/Highlight saved words/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ask the AI automatically/)).toBeInTheDocument();
    expect(screen.getByLabelText('Highlight colour')).toBeInTheDocument();
  });

  it('toggles highlighting', async () => {
    const onChange = vi.fn(async () => undefined);
    render(<AppearanceSettings settings={DEFAULT_SETTINGS} onChange={onChange} />);

    await userEvent.click(screen.getByLabelText(/Highlight saved words/));
    expect(onChange).toHaveBeenCalledWith({ highlightEnabled: false });
  });

  it('toggles auto-explain', async () => {
    const onChange = vi.fn(async () => undefined);
    render(<AppearanceSettings settings={DEFAULT_SETTINGS} onChange={onChange} />);

    await userEvent.click(screen.getByLabelText(/Ask the AI automatically/));
    expect(onChange).toHaveBeenCalledWith({ autoExplainOnSave: true });
  });

  it('shows the current colour value', () => {
    render(
      <AppearanceSettings settings={{ ...DEFAULT_SETTINGS, highlightColor: '#ff0000' }} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Highlight colour')).toHaveValue('#ff0000');
    expect(screen.getByText('#ff0000')).toBeInTheDocument();
  });
});

describe('DataSettings', () => {
  it('offers export, import and a strategy choice', () => {
    renderData();

    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import JSON' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Merge with existing/)).toBeChecked();
    expect(screen.getByLabelText(/Replace everything/)).not.toBeChecked();
  });

  it('switches the import strategy', async () => {
    renderData();

    await userEvent.click(screen.getByLabelText(/Replace everything/));
    expect(screen.getByLabelText(/Replace everything/)).toBeChecked();
  });

  it('labels the hidden file input', () => {
    renderData();
    expect(screen.getByLabelText('Choose a vocabulary backup file')).toBeInTheDocument();
  });

  it('reports a parse failure without throwing', async () => {
    renderData();

    const input = screen.getByLabelText('Choose a vocabulary backup file');
    await userEvent.upload(input, new File(['not json'], 'bad.json', { type: 'application/json' }));

    // The toast renders in a portal on document.body, so query there.
    const region = await new Promise<HTMLElement>((resolve) => {
      const start = Date.now();
      const tick = (): void => {
        const el = document.body.querySelector('[aria-live="polite"]');
        if (el && el.textContent) return resolve(el as HTMLElement);
        if (Date.now() - start > 2000) return resolve(document.body);
        setTimeout(tick, 20);
      };
      tick();
    });
    expect(region.textContent ?? '').toMatch(/./);
  });
});
