import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Select } from './Select';
import { TagInput } from './TagInput';
import { TextField } from './TextField';
import { EmptyState } from './EmptyState';
import { Spinner } from './Spinner';

describe('Button', () => {
  it('renders and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('exposes an accessible name for an icon-only control', () => {
    render(<IconButton label="Favorite cake"><span>★</span></IconButton>);
    expect(screen.getByRole('button', { name: 'Favorite cake' })).toBeInTheDocument();
  });

  it('reflects pressed state', () => {
    render(
      <IconButton label="Favorite" active>
        <span>★</span>
      </IconButton>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('TextField', () => {
  it('associates the label with the input', async () => {
    render(<TextField label="Word" />);
    await userEvent.type(screen.getByLabelText('Word'), 'cake');
    expect(screen.getByLabelText('Word')).toHaveValue('cake');
  });

  it('announces errors', () => {
    render(<TextField label="Word" error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.getByLabelText('Word')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders a hint when there is no error', () => {
    render(<TextField label="Word" hint="Helpful" />);
    expect(screen.getByText('Helpful')).toBeInTheDocument();
  });
});

describe('Select', () => {
  it('renders options and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Provider"
        value="openai"
        onChange={onChange}
        options={[
          { value: 'openai', label: 'OpenAI' },
          { value: 'gemini', label: 'Gemini' },
        ]}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Provider'), 'gemini');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('TagInput', () => {
  it('adds a tag on Enter', async () => {
    const onChange = vi.fn();
    render(<TagInput label="Tags" tags={[]} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Tags'), 'Business{Enter}');
    expect(onChange).toHaveBeenCalledWith(['business']);
  });

  it('adds a tag on comma', async () => {
    const onChange = vi.fn();
    render(<TagInput label="Tags" tags={[]} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Tags'), 'idiom,');
    expect(onChange).toHaveBeenCalledWith(['idiom']);
  });

  it('removes a tag with its remove button', async () => {
    const onChange = vi.fn();
    render(<TagInput label="Tags" tags={['idiom']} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove tag idiom' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('removes the last tag on Backspace with an empty draft', async () => {
    const onChange = vi.fn();
    render(<TagInput label="Tags" tags={['a', 'b']} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Tags'), '{Backspace}');
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('ignores duplicates', async () => {
    const onChange = vi.fn();
    render(<TagInput label="Tags" tags={['idiom']} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Tags'), 'idiom{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('EmptyState / Spinner', () => {
  it('renders content', () => {
    render(<EmptyState title="No words yet" description="Save one." />);
    expect(screen.getByText('No words yet')).toBeInTheDocument();
  });

  it('exposes a live status', () => {
    render(<Spinner label="Loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
});
