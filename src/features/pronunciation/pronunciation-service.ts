import { toLocale } from '@/ai/language-codes';

/**
 * Playback state surfaced to the UI.
 *
 * - `idle`:    nothing happening for this word.
 * - `loading`: clicked, waiting for the speech engine / voice list.
 * - `playing`: utterance is actively speaking.
 * - `error`:   the engine reported an error or no matching voice exists.
 */
export type PronunciationStateName = 'idle' | 'loading' | 'playing' | 'error';

export interface PronunciationState {
  state: PronunciationStateName;
  /** The word currently associated with this state (matches the UI's word). */
  word: string;
  /** The raw language string passed to `speak` (not necessarily normalised). */
  language: string;
  /** Human-readable technical detail, present only in the `error` state. */
  error?: string;
}

export interface PronunciationHandlers {
  /** Fired when the utterance begins speaking. */
  onStart?: () => void;
  /** Fired when speaking ends naturally or is cancelled. */
  onEnd?: () => void;
  /** Fired when the engine errors or no voice is available for the language. */
  onError?: (error: Error) => void;
}

export interface PronunciationService {
  /** True when the host environment can speak (browser SpeechSynthesis present). */
  isSupported(): boolean;
  /**
   * Speak `word` in `language` (any form the app stores: display name, bare
   * code, or full locale — it is normalised internally). Language is a
   * first-class input; the correct voice is selected from it. Only one
   * utterance plays at a time — any in-flight speech is cancelled first.
   * Resolves after the utterance is queued; outcomes arrive via `handlers`
   * and `subscribe`. Never rejects, so callers need not try/catch.
   */
  speak(word: string, language: string, handlers?: PronunciationHandlers): void;
  /** Stop/cancel any in-flight pronunciation. */
  stop(): void;
  /** Subscribe to global playback-state changes. Returns an unsubscribe fn. */
  subscribe(listener: (state: PronunciationState) => void): () => void;
}

/**
 * Pick the best available voice for a requested BCP-47 locale.
 *
 * Preference order (never falls back to a *different* language):
 *   1. Exact locale match           e.g. requested "fr-FR" → "fr-FR"
 *   2. Same-language, any region     e.g. requested "fr-FR" → "fr-CA" or "fr"
 *   3. None                          → null (caller shows "unavailable")
 */
export function selectVoice(
  voices: SpeechSynthesisVoice[],
  requested: string,
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const req = requested.toLowerCase();
  const reqLang = req.split('-')[0];

  const exact = voices.find((voice) => voice.lang.toLowerCase() === req);
  if (exact) return exact;

  const sameLanguage = voices.find(
    (voice) => voice.lang.toLowerCase().split('-')[0] === reqLang,
  );
  return sameLanguage ?? null;
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    speechSynthesis?: SpeechSynthesis;
    SpeechSynthesisUtterance?: unknown;
  };
  if (!w.speechSynthesis || typeof w.SpeechSynthesisUtterance !== 'function') return null;
  return w.speechSynthesis;
}

export class BrowserPronunciationService implements PronunciationService {
  private readonly listeners = new Set<(state: PronunciationState) => void>();
  private current: { word: string; language: string } | null = null;
  private readonly supported = getSynth() !== null;

  isSupported(): boolean {
    return this.supported;
  }

  subscribe(listener: (state: PronunciationState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(state: PronunciationState): void {
    for (const listener of this.listeners) listener(state);
  }

  stop(): void {
    const synth = getSynth();
    if (!synth) return;
    synth.cancel();
    if (this.current) {
      const finished = this.current;
      this.current = null;
      this.emit({ state: 'idle', word: finished.word, language: finished.language });
    }
  }

  speak(word: string, language: string, handlers?: PronunciationHandlers): void {
    const synth = getSynth();
    const target = word.trim();
    if (!synth || !target) {
      const reason = !synth ? 'Speech synthesis unsupported' : 'Empty word';
      handlers?.onError?.(new Error(reason));
      this.emit({ state: 'error', word: target, language, error: reason });
      return;
    }

    // Only one at a time: cancel whatever is currently speaking.
    this.stop();

    const locale = toLocale(language);
    void this.run(target, language, locale, synth, handlers);
  }

  private async run(
    word: string,
    language: string,
    locale: string,
    synth: SpeechSynthesis,
    handlers?: PronunciationHandlers,
  ): Promise<void> {
    const voices = await this.loadVoices();
    const voice = selectVoice(voices, locale);
    if (!voice) {
      const reason = `No voice available for ${locale}`;
      handlers?.onError?.(new Error(reason));
      this.emit({ state: 'error', word, language, error: reason });
      return;
    }

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = locale;
    utterance.voice = voice;

    const handle = { word, language };
    this.current = handle;
    this.emit({ state: 'loading', word, language });

    utterance.onstart = () => {
      if (this.current === handle) this.emit({ state: 'playing', word, language });
    };
    utterance.onend = () => {
      if (this.current !== handle) return;
      this.current = null;
      this.emit({ state: 'idle', word, language });
      handlers?.onEnd?.();
    };
    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      if (this.current !== handle) return;
      this.current = null;
      const reason = event.error || 'speech error';
      this.emit({ state: 'error', word, language, error: reason });
      handlers?.onError?.(new Error(reason));
    };

    synth.speak(utterance);
    handlers?.onStart?.();
  }

  /** Voices may not be loaded synchronously; wait for `voiceschanged` (or a cap). */
  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    const synth = getSynth();
    if (!synth) return Promise.resolve([]);
    const existing = synth.getVoices();
    if (existing.length) return Promise.resolve(existing);

    return new Promise<SpeechSynthesisVoice[]>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        synth.removeEventListener('voiceschanged', finish);
        resolve(synth.getVoices());
      };
      synth.addEventListener('voiceschanged', finish);
      // Cap the wait so a browser that never fires the event still resolves.
      setTimeout(finish, 1000);
    });
  }
}

/** Shared singleton — guarantees a single in-flight utterance across the app. */
export const pronunciationService: PronunciationService = new BrowserPronunciationService();
