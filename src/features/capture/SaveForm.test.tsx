import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveForm } from './SaveForm';

const selection = {
  word: 'serendipity',
  sentence: 'Pure serendipity struck.',
  precedingText: 'Everyone noticed',
  sourceUrl: 'https://example.com',
  sourceTitle: 'Example',
  sourceLanguage: 'English',
};

describe('SaveForm', () => {
  it('prefills from the current selection', () => {
    const onWordChange = vi.fn();
    render(<SaveForm selection={selection} saving={false} word="serendipity" onWordChange={onWordChange} onSave={vi.fn()} />);

    expect(screen.getByLabelText('Word or phrase')).toHaveValue('serendipity');
    expect(screen.getByText(/Pure serendipity struck\./)).toBeInTheDocument();
  });

  it('submits the trimmed word with note and tags', async () => {
    const onSave = vi.fn(async () => undefined);
    const Harness = () => {
      const [w, setW] = useState('');
      return <SaveForm selection={null} saving={false} word={w} onWordChange={setW} onSave={onSave} />;
    };
    render(<Harness />);

    await userEvent.type(screen.getByLabelText('Word or phrase'), '  ephemeral  ');
    await userEvent.type(screen.getByLabelText('Note'), 'short-lived');
    await userEvent.type(screen.getByLabelText('Tags'), 'adjective{Enter}');
    await userEvent.click(screen.getByRole('button', { name: /save to vocabulary/i }));

    expect(onSave).toHaveBeenCalledWith({
      word: 'ephemeral',
      note: 'short-lived',
      tags: ['adjective'],
    });
  });

  it('validates an empty word', async () => {
    const onSave = vi.fn();
    render(<SaveForm selection={null} saving={false} word="" onWordChange={vi.fn()} onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: /save to vocabulary/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Type or select a word first.');
  });

  it('disables the button while saving', () => {
    render(<SaveForm selection={null} saving word="" onWordChange={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });
});
