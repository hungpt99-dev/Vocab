import { useEffect, useState } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { VolumeIcon, VolumeMutedIcon, SpinnerIcon } from '@/shared/ui/Icons';
import { pronunciationService, type PronunciationState } from './pronunciation-service';

export interface PronunciationButtonProps {
  /** The vocabulary word/phrase to pronounce. */
  word: string;
  /**
   * The word's source language in whatever form the app stores it (display
   * name like "Japanese", a bare code like "vi", or a full locale like "fr-FR").
   * Normalised internally — never assumed to be English.
   */
  language: string;
  className?: string;
}

/**
 * Compact, accessible speaker button that plays a word's pronunciation in its
 * own language. Presentation only: all speech logic lives in
 * `pronunciationService`. Clicking while speaking (or loading) stops it; a
 * second click starts it again. Because the service is a singleton, starting a
 * different word cancels any in-flight speech automatically.
 */
export function PronunciationButton({ word, language, className = '' }: PronunciationButtonProps) {
  const supported = pronunciationService.isSupported();
  const [state, setState] = useState<PronunciationState>({ state: 'idle', word: '', language: '' });

  useEffect(() => pronunciationService.subscribe(setState), []);

  const known = Boolean(language && language.trim());
  const disabled = !supported || !known;
  // This button is the source of the current utterance only when the global
  // state matches its word+language exactly.
  const active = state.word === word && state.language === language;
  const playing = active && (state.state === 'playing' || state.state === 'loading');

  const label = disabled
    ? 'Pronunciation unavailable'
    : `Listen to pronunciation of ${word}`;

  const onClick = (): void => {
    if (disabled) return;
    if (active && (state.state === 'playing' || state.state === 'loading')) {
      pronunciationService.stop();
    } else {
      pronunciationService.speak(word, language);
    }
  };

  let glyph: React.ReactNode;
  if (active && state.state === 'loading') {
    glyph = <SpinnerIcon size={16} className="animate-spin" aria-hidden="true" />;
  } else if (active && state.state === 'error') {
    glyph = <VolumeMutedIcon size={16} aria-hidden="true" />;
  } else if (playing) {
    // Playing: same speaker glyph with a subtle pulse to signal activity.
    glyph = <VolumeIcon size={16} className="animate-pulse" aria-hidden="true" />;
  } else {
    glyph = <VolumeIcon size={16} aria-hidden="true" />;
  }

  return (
    <IconButton
      label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {glyph}
    </IconButton>
  );
}
