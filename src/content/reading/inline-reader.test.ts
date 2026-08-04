import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InlineReader } from './inline-reader';
import { sendMessage } from '@/shared/messaging/client';
import { settingsRepository } from '@/storage/settings-repository';
import { showToast } from '../toast';
import type { WordAlignResult } from '@/ai/types';

vi.mock('@/shared/messaging/client', () => ({
  sendMessage: vi.fn(),
}));
vi.mock('@/storage/settings-repository', () => ({
  settingsRepository: { get: vi.fn() },
}));
vi.mock('../toast', () => ({
  showToast: vi.fn(),
}));

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Control when sendMessage resolves so we can freeze injectAll mid-flight. */
let resolveSend: (value: unknown) => void = () => {};
let sendDeferred: Promise<unknown>;
function defer(): void {
  sendDeferred = new Promise((resolve) => {
    resolveSend = resolve as (value: unknown) => void;
  });
}

function glossResponse(): WordAlignResult[] {
  return [
    {
      id: '0',
      text: 'Hello world',
      pairs: [
        { source: 'Hello', target: 'Xin' },
        { source: 'world', target: 'chào' },
      ],
      translation: 'Xin chào',
    },
    {
      id: '1',
      text: 'Goodbye world',
      pairs: [
        { source: 'Goodbye', target: 'Tạm biệt' },
        { source: 'world', target: 'chào' },
      ],
      translation: 'Tạm biệt chào',
    },
  ];
}

function stubSettings(): void {
  vi.spyOn(settingsRepository, 'get').mockResolvedValue({
    bilingualMode: true,
    targetLanguage: 'Vietnamese',
  } as never);
}

describe('InlineReader bilingual injection', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<article><p>Hello world</p><p>Goodbye world</p></article>';
    defer();
    stubSettings();
    vi.mocked(sendMessage).mockImplementation(async (message) => {
      if (message.type === 'align-words') {
        const paragraphs = message.payload.paragraphs as Array<{ id: string; text: string }>;
        const data = (await sendDeferred) as WordAlignResult[];
        // Echo the requested ids so injected nodes map to real paragraphs.
        return paragraphs.map((paragraph, index) => ({
          id: paragraph.id,
          text: paragraph.text,
          pairs: data[index]?.pairs ?? [],
          translation: data[index]?.translation ?? '',
        })) as never;
      }
      return [] as never;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('does not duplicate glosses when closed while a batch is in flight', async () => {
    const reader = new InlineReader();

    // Kick off open() but do NOT await it: injectAll is now parked on sendMessage.
    void reader.open();
    await flush();

    // A rapid close() supersedes the in-flight batch (generation bumped).
    reader.close();

    // The stalled align response finally arrives …
    resolveSend(glossResponse());
    await flush();
    await flush();

    // … but the stale batch must have been discarded, not appended.
    expect(document.querySelectorAll('.avs-gloss-word').length).toBe(0);
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(0);

    // A fresh open() in word mode wraps each source word in a gloss span and
    // emits one translation line per paragraph. The two paragraphs differ, so
    // two distinct lines appear (dedup only suppresses identical neighbours).
    await reader.open();
    await flush();
    await flush();
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(2);
    expect(document.querySelectorAll('.avs-gloss-word').length).toBe(4);

    reader.close();
  });

  it('injects a single gloss per paragraph on a normal open (word mode: one translation line, deduped)', async () => {
    const reader = new InlineReader();
    resolveSend(glossResponse());
    await reader.open();
    await flush();
    await flush();
    // Word mode wraps source words and emits one translation line per paragraph
    // (the two test paragraphs are different, so two distinct lines appear).
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(2);
    expect(document.querySelectorAll('.avs-gloss-word').length).toBe(4);
    reader.close();
  });

  it('dedupes consecutive identical translation lines (same paragraph text repeated)', async () => {
    document.body.innerHTML =
      '<article><p>Hello world</p><p>Hello world</p></article>';
    defer();
    stubSettings();
    vi.mocked(sendMessage).mockImplementation(async (message) => {
      if (message.type === 'align-words') {
        const paragraphs = message.payload.paragraphs as Array<{ id: string; text: string }>;
        const data = (await sendDeferred) as WordAlignResult[];
        return paragraphs.map((paragraph, index) => ({
          id: paragraph.id,
          text: paragraph.text,
          pairs: data[index]?.pairs ?? [],
          translation: data[index]?.translation ?? '',
        })) as never;
      }
      return [] as never;
    });

    const reader = new InlineReader();
    // Both paragraphs are "Hello world"; force the mock to return the same
    // translation for both so we exercise the consecutive-dedup guard.
    resolveSend([
      { id: '0', text: 'Hello world', pairs: [{ source: 'Hello', target: 'Xin' }, { source: 'world', target: 'chào' }], translation: 'Xin chào' },
      { id: '1', text: 'Hello world', pairs: [{ source: 'Hello', target: 'Xin' }, { source: 'world', target: 'chào' }], translation: 'Xin chào' },
    ] as WordAlignResult[]);
    await reader.open();
    await flush();
    await flush();
    // Two identical paragraphs resolve to the same translation; the guard keeps
    // only one visible line instead of stacking a duplicate.
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(1);
    expect(document.querySelectorAll('.avs-gloss-word').length).toBe(4);
    reader.close();
  });

  it('surfaces an actionable toast when the AI call fails (no silent monolingual page)', async () => {
    vi.mocked(sendMessage).mockImplementation(async (message) => {
      if (message.type === 'align-words') throw Object.assign(new Error('An API key is required.'), { code: 'missing_api_key' });
      return [] as never;
    });

    const reader = new InlineReader();
    await reader.open();
    await flush();
    await flush();

    // Nothing injected, but the failure must be reported — not swallowed.
    expect(document.querySelectorAll('.avs-gloss-word').length).toBe(0);
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(0);
    expect(vi.mocked(showToast)).toHaveBeenCalledWith(
      expect.stringContaining('API key'),
      'error',
    );

    reader.close();
  });
});
