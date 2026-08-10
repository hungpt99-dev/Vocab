import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsRow } from './StatsRow';

describe('StatsRow', () => {
  it('renders total, added-today, and streak with accessible labels', () => {
    render(<StatsRow total={12} addedToday={3} streak={5} />);
    const region = screen.getByLabelText('Your vocabulary progress');
    expect(region).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Words')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Streak')).toBeTruthy();
  });

  it('handles zero stats without throwing', () => {
    render(<StatsRow total={0} addedToday={0} streak={0} />);
    expect(screen.getAllByText('0').length).toBe(3);
  });
});
