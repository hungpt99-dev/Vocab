import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BilingualSettings } from './BilingualSettings';
import type { Settings } from '@/shared/types/settings';

const baseSettings: Settings = {
  apiProvider: 'keyless',
  activeProviderId: 'keyless',
  providers: { keyless: { id: 'keyless', kind: 'keyless' } },
  targetLanguage: 'English',
  readingMode: 'everywhere',
  allowedDomains: [],
  explainPromptTemplate: '',
} as unknown as Settings;

describe('BilingualSettings target language', () => {
  it('renders a select dropdown with the language options', () => {
    render(<BilingualSettings settings={baseSettings} onChange={vi.fn()} />);
    const select = screen.getByLabelText(/Target language/i);
    expect(select.tagName).toBe('SELECT');
    // English and Vietnamese should be present as options
    expect(screen.getByRole('option', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Vietnamese' })).toBeTruthy();
  });

  it('keeps a custom target language value selectable', () => {
    render(
      <BilingualSettings settings={{ ...baseSettings, targetLanguage: 'Klingon' }} onChange={vi.fn()} />,
    );
    const option = screen.getByRole('option', { name: /Klingon \(custom\)/i });
    expect(option).toBeTruthy();
    expect((option as HTMLOptionElement).value).toBe('Klingon');
  });
});
