import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chromeMock } from '@/test/chrome-mock';
import { TranslatePanel } from './TranslatePanel';

const selection = {
  word: 'serendipity',
  sentence: 'Pure serendipity struck.',
  precedingText: 'Everyone noticed',
  sourceUrl: 'https://example.com',
  sourceTitle: 'Example',
  sourceLanguage: 'English',
};

describe('TranslatePanel', () => {
  it('renders nothing without a selection', () => {
    render(<TranslatePanel selection={null} />);
    expect(screen.queryByRole('button', { name: /translate selection/i })).not.toBeInTheDocument();
  });

  it('renders for the current selection and translates it', async () => {
    (chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: '巧合',
    });

    render(<TranslatePanel selection={selection} />);
    await userEvent.click(screen.getByRole('button', { name: /translate selection/i }));

    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: 'translate',
      payload: { text: 'serendipity' },
    });
    expect(await screen.findByText('巧合')).toBeVisible();
  });

  it('surfaces a background failure next to the action', async () => {
    (chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: 'No provider configured.',
    });

    render(<TranslatePanel selection={selection} />);
    await userEvent.click(screen.getByRole('button', { name: /translate selection/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No provider configured.'));
  });
});
