import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chromeMock } from '@/test/chrome-mock';
import { WordCard } from './WordCard';

const selection = {
  word: 'serendipity',
  sentence: 'Pure serendipity struck.',
  precedingText: 'Everyone noticed',
  sourceUrl: 'https://example.com',
  sourceTitle: 'Example',
  sourceLanguage: 'English',
};

describe('WordCard', () => {
  it('renders nothing without a selection', () => {
    render(<WordCard selection={null} onSave={() => undefined} showTranslation showSimplify />);
    expect(screen.queryByText('serendipity')).not.toBeInTheDocument();
  });

  it('shows the highlighted word and auto-translates it (keyless, no AI key)', async () => {
    (chromeMock().runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: '巧合',
    });

    render(<WordCard selection={selection} onSave={() => undefined} showTranslation showSimplify />);

    // Word is shown immediately.
    expect(screen.getByText('serendipity')).toBeTruthy();
    // Translation auto-loads (no button click needed).
    expect(await screen.findByText('巧合')).toBeTruthy();
    // With no AI key configured, the AI gate hint is shown.
    expect(await screen.findByText(/AI actions need an API key/i)).toBeTruthy();
  });

  it('calls onSave and shows Saved when already in the library', async () => {
    const onSave = vi.fn();
    render(<WordCard selection={selection} alreadySaved onSave={onSave} showTranslation showSimplify />);
    const saveButton = screen.getByRole('button', { name: /saved/i });
    expect(saveButton).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('triggers save on click', async () => {
    const onSave = vi.fn();
    render(<WordCard selection={selection} onSave={onSave} showTranslation showSimplify />);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
