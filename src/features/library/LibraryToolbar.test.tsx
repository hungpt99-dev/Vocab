import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryToolbar } from './LibraryToolbar';

const filters = { search: '', favoritesOnly: false, tag: '' };

describe('LibraryToolbar', () => {
  it('reports search input', async () => {
    const onChange = vi.fn();
    render(<LibraryToolbar filters={filters} tags={[]} count={0} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Search vocabulary'), 'a');
    expect(onChange).toHaveBeenCalledWith({ ...filters, search: 'a' });
  });

  it('toggles the favorites filter', async () => {
    const onChange = vi.fn();
    render(<LibraryToolbar filters={filters} tags={[]} count={0} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /favorites/i }));
    expect(onChange).toHaveBeenCalledWith({ ...filters, favoritesOnly: true });
  });

  it('selects and clears a tag', async () => {
    const onChange = vi.fn();
    render(<LibraryToolbar filters={filters} tags={['noun']} count={1} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'noun' }));
    expect(onChange).toHaveBeenCalledWith({ ...filters, tag: 'noun' });
  });

  it('pluralises the count', () => {
    const { rerender } = render(
      <LibraryToolbar filters={filters} tags={[]} count={1} onChange={vi.fn()} />,
    );
    expect(screen.getByText('1 word')).toBeInTheDocument();

    rerender(<LibraryToolbar filters={filters} tags={[]} count={3} onChange={vi.fn()} />);
    expect(screen.getByText('3 words')).toBeInTheDocument();
  });
});
