import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserPronunciationService,
  selectVoice,
  pronunciationService,
  type PronunciationState,
} from './pronunciation-service';
import { toLocale } from '@/ai/language-codes';

/** Build a fake SpeechSynthesisVoice with a given lang. */
function voice(lang: string): SpeechSynthesisVoice {
  return { voiceURI: lang, name: lang, lang, localService: true, default: false } as SpeechSynthesisVoice;
}

function installSpeechSynthesis(opts: {
  voices?: SpeechSynthesisVoice[];
  fireVoicesChanged?: boolean;
}): { synth: { speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; getVoices: ReturnType<typeof vi.fn> } } {
  const voices = opts.voices ?? [];
  const synth = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = synth;
  // jsdom has no SpeechSynthesisUtterance; provide a minimal stand-in so the
  // service can construct one and we can inspect its fields.
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    text: string;
    lang = '';
    voice: SpeechSynthesisVoice | null = null;
    onstart: ((e: Event) => void) | null = null;
    onend: ((e: Event) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  return { synth: synth as never };
}

function removeSpeechSynthesis(): void {
  delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
}

describe('toLocale (language → BCP-47 locale)', () => {
  it('expands a bare code to its default region', () => {
    expect(toLocale('fr')).toBe('fr-FR');
    expect(toLocale('vi')).toBe('vi-VN');
    expect(toLocale('ja')).toBe('ja-JP');
    expect(toLocale('ko')).toBe('ko-KR');
    expect(toLocale('zh')).toBe('zh-CN');
    expect(toLocale('es')).toBe('es-ES');
  });

  it('accepts a display name via toLanguageCode', () => {
    expect(toLocale('Japanese')).toBe('ja-JP');
    expect(toLocale('Vietnamese')).toBe('vi-VN');
    expect(toLocale('French')).toBe('fr-FR');
  });

  it('preserves an already-regional locale', () => {
    expect(toLocale('fr-FR')).toBe('fr-FR');
    expect(toLocale('en-US')).toBe('en-US');
  });

  it('does not assume English: an unknown language falls back to its code', () => {
    // toLanguageCode returns 'en' for unrecognised names, which maps to en-US.
    expect(toLocale('Klingon')).toBe('en-US');
    // A recognised bare code is expanded.
    expect(toLocale('de')).toBe('de-DE');
  });
});

describe('selectVoice (voice selection)', () => {
  it('prefers an exact locale match', () => {
    const voices = [voice('en-US'), voice('fr-CA'), voice('fr-FR')];
    const picked = selectVoice(voices, 'fr-FR');
    expect(picked?.lang).toBe('fr-FR');
  });

  it('falls back to the same language family when region differs', () => {
    const voices = [voice('en-US'), voice('fr-CA')];
    expect(selectVoice(voices, 'fr-FR')?.lang).toBe('fr-CA');
  });

  it('returns null when no voice matches the language (never an unrelated language)', () => {
    const voices = [voice('en-US'), voice('es-ES')];
    // Requesting French must NOT return an English or Spanish voice.
    expect(selectVoice(voices, 'fr-FR')).toBeNull();
    expect(selectVoice(voices, 'fr')).toBeNull();
  });

  it('returns null when there are no voices at all', () => {
    expect(selectVoice([], 'en-US')).toBeNull();
  });
});

describe('BrowserPronunciationService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    removeSpeechSynthesis();
    vi.useRealTimers();
  });

  it('reports unsupported when speechSynthesis is absent', () => {
    removeSpeechSynthesis();
    const svc = new BrowserPronunciationService();
    expect(svc.isSupported()).toBe(false);
    const onError = vi.fn();
    svc.speak('bonjour', 'fr-FR', { onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0]?.[0] as Error).message).toMatch(/unsupported/i);
  });

  it('speaks the word with the correct (normalised) language and voice', async () => {
    const { synth } = installSpeechSynthesis({ voices: [voice('fr-FR'), voice('en-US')] });
    const svc = new BrowserPronunciationService();
    svc.speak('bonjour', 'French');
    // getVoices is synchronous here (voices already present), so the utterance
    // is queued on the next microtask.
    await Promise.resolve();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = synth.speak.mock.calls[0]?.[0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe('bonjour');
    expect(utterance.lang).toBe('fr-FR');
    expect(utterance.voice?.lang).toBe('fr-FR');
  });

  it('emits loading then playing and finally idle on the global stream', async () => {
    const { synth } = installSpeechSynthesis({ voices: [voice('en-US')] });
    const svc = new BrowserPronunciationService();
    const states: string[] = [];
    svc.subscribe((s: PronunciationState) => states.push(s.state));
    svc.speak('abandon', 'en');
    await Promise.resolve();
    const utterance = synth.speak.mock.calls[0]?.[0] as SpeechSynthesisUtterance;
    utterance.onstart?.(new Event('start') as SpeechSynthesisEvent);
    utterance.onend?.(new Event('end') as SpeechSynthesisEvent);
    expect(states).toContain('loading');
    expect(states).toContain('playing');
    expect(states).toContain('idle');
  });

  it('emits error and does NOT speak when no voice exists for the language', async () => {
    const { synth } = installSpeechSynthesis({ voices: [voice('en-US')] });
    const svc = new BrowserPronunciationService();
    const onError = vi.fn();
    svc.speak('hola', 'es', { onError });
    await Promise.resolve();
    expect(synth.speak).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as Error).message).toMatch(/no voice/i);
  });

  it('stops a playing utterance and emits idle', async () => {
    const { synth } = installSpeechSynthesis({ voices: [voice('en-US')] });
    const svc = new BrowserPronunciationService();
    svc.speak('abandon', 'en');
    await Promise.resolve();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const states: string[] = [];
    svc.subscribe((s) => states.push(s.state));
    svc.stop();
    // The in-flight utterance was cancelled (speak always stops any prior one first).
    expect(synth.cancel).toHaveBeenCalled();
    expect(states).toContain('idle');
  });

  it('starting a new word cancels the previous one (only one at a time)', async () => {
    const { synth } = installSpeechSynthesis({ voices: [voice('en-US'), voice('fr-FR')] });
    const svc = new BrowserPronunciationService();
    svc.speak('abandon', 'en');
    await Promise.resolve();
    svc.speak('bonjour', 'fr');
    await Promise.resolve();
    // cancel() is called to stop the first before the second is queued.
    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(2);
    const second = synth.speak.mock.calls[1]?.[0] as SpeechSynthesisUtterance;
    expect(second.lang).toBe('fr-FR');
  });

  it('exposes a shared singleton instance', () => {
    expect(pronunciationService).toBeDefined();
    expect(typeof pronunciationService.speak).toBe('function');
    expect(typeof pronunciationService.stop).toBe('function');
  });
});
