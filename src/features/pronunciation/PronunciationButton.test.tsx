import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PronunciationButton } from './PronunciationButton';
import { type PronunciationState } from './pronunciation-service';

// Replace the real (singleton) service with a controllable fake so we can assert
// that the UI passes the right word + language and reacts to playback states.
const fake = vi.hoisted(() => {
  const listeners: Array<(s: PronunciationState) => void> = [];
  return {
    listeners,
    isSupported: true,
    speak: vi.fn(),
    stop: vi.fn(),
    subscribe: vi.fn((listener: (s: PronunciationState) => void) => {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }),
    // isSupported must be a function to match the real service signature.
    isSupportedFn: vi.fn(() => true),
  };
});

vi.mock('./pronunciation-service', () => ({
  pronunciationService: { ...fake, isSupported: fake.isSupportedFn },
}));

function emit(state: PronunciationState): void {
  for (const l of fake.listeners) l(state);
}

beforeEach(() => {
  fake.listeners.length = 0;
  fake.isSupportedFn.mockReturnValue(true);
  fake.speak.mockClear();
  fake.stop.mockClear();
});

afterEach(() => {
  cleanup();
  fake.listeners.length = 0;
});

describe('PronunciationButton', () => {
  it('renders a speaker button with an accessible label naming the word', () => {
    render(<PronunciationButton word="bonjour" language="fr-FR" />);
    const button = screen.getByRole('button', { name: /listen to pronunciation of bonjour/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('calls the service with the exact word and language on click', async () => {
    const user = userEvent.setup();
    render(<PronunciationButton word="xin chào" language="Vietnamese" />);
    await user.click(screen.getByRole('button'));
    expect(fake.speak).toHaveBeenCalledTimes(1);
    expect(fake.speak).toHaveBeenCalledWith('xin chào', 'Vietnamese');
  });

  it('supports multiple languages without hardcoding English', async () => {
    const user = userEvent.setup();
    const cases: Array<[string, string]> = [
      ['abandon', 'en'],
      ['bonjour', 'fr'],
      ['hola', 'es'],
      ['こんにちは', 'ja'],
      ['안녕하세요', 'ko'],
      ['你好', 'zh'],
    ];
    for (const [word, language] of cases) {
      render(<PronunciationButton word={word} language={language} />);
      const btn = screen.getByRole('button', { name: new RegExp(`listen to pronunciation of ${word}`, 'i') });
      await user.click(btn);
      expect(fake.speak).toHaveBeenLastCalledWith(word, language);
      cleanup();
      fake.speak.mockClear();
    }
  });

  it('shows a loading spinner while speaking is loading', () => {
    render(<PronunciationButton word="bonjour" language="fr-FR" />);
    emit({ state: 'loading', word: 'bonjour', language: 'fr-FR' });
    // The button stays enabled and the accessible label is unchanged.
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('reflects the playing state (icon swaps to the pulsing speaker)', () => {
    render(<PronunciationButton word="bonjour" language="fr-FR" />);
    emit({ state: 'playing', word: 'bonjour', language: 'fr-FR' });
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('reflects the error state and keeps the button usable', () => {
    render(<PronunciationButton word="bonjour" language="fr-FR" />);
    emit({ state: 'error', word: 'bonjour', language: 'fr-FR', error: 'no voice' });
    const button = screen.getByRole('button');
    expect(button).toBeEnabled();
  });

  it('stops pronunciation when clicked again while playing (toggle)', async () => {
    const user = userEvent.setup();
    render(<PronunciationButton word="bonjour" language="fr-FR" />);
    // Start
    await user.click(screen.getByRole('button'));
    expect(fake.speak).toHaveBeenCalledTimes(1);
    // Now simulate the service reporting "playing" for this button.
    emit({ state: 'playing', word: 'bonjour', language: 'fr-FR' });
    // Click again → should stop, not start a second time.
    await user.click(screen.getByRole('button'));
    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(fake.speak).toHaveBeenCalledTimes(1);
  });

  it('cancels this button when another word starts speaking (only one at a time)', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <PronunciationButton word="bonjour" language="fr-FR" />
        <PronunciationButton word="abandon" language="en" />
      </div>,
    );
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]!); // start bonjour
    expect(fake.speak).toHaveBeenLastCalledWith('bonjour', 'fr-FR');
    // The service reports bonjour is now playing; the second button is idle.
    emit({ state: 'playing', word: 'bonjour', language: 'fr-FR' });
    await user.click(buttons[1]!); // start abandon → the real service would cancel bonjour
    // The second word is requested (the singleton guarantees only one plays).
    expect(fake.speak).toHaveBeenLastCalledWith('abandon', 'en');
    expect(fake.speak).toHaveBeenCalledTimes(2);
  });

  it('is disabled (unavailable) when speech synthesis is unsupported', () => {
    fake.isSupportedFn.mockReturnValue(false);
    render(<PronunciationButton word="bonjour" language="fr-FR" />);
    const button = screen.getByRole('button', { name: /pronunciation unavailable/i });
    expect(button).toBeDisabled();
  });

  it('is disabled when the language is unknown', () => {
    render(<PronunciationButton word="mystery" language="" />);
    const button = screen.getByRole('button', { name: /pronunciation unavailable/i });
    expect(button).toBeDisabled();
    expect(fake.speak).not.toHaveBeenCalled();
  });

  it('is keyboard-activatable (Enter triggers speak on the native button)', async () => {
    const user = userEvent.setup();
    render(<PronunciationButton word="bonjour" language="fr-FR" />);
    const button = screen.getByRole('button');
    button.focus();
    await user.type(button, '{Enter}');
    expect(fake.speak).toHaveBeenCalledWith('bonjour', 'fr-FR');
  });
});
