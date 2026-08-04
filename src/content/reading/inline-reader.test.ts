import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InlineReader } from './inline-reader';
import { sendMessage } from '@/shared/messaging/client';
import { settingsRepository } from '@/storage/settings-repository';
import type { WordAlignResult } from '@/ai/types';

vi.mock('@/shared/messaging/client', () => ({
  sendMessage: vi.fn(),
}));
vi.mock('@/storage/settings-repository', () => ({
  settingsRepository: { get: vi.fn() },
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
    expect(document.querySelectorAll('.avs-gloss-block').length).toBe(0);

    // A fresh open() injects exactly one gloss per paragraph (no duplicates).
    await reader.open();
    await flush();
    await flush();
    expect(document.querySelectorAll('.avs-gloss-block').length).toBe(2);

    reader.close();
  });

  it('injects a single gloss per paragraph on a normal open', async () => {
    const reader = new InlineReader();
    resolveSend(glossResponse());
    await reader.open();
    await flush();
    await flush();
    expect(document.querySelectorAll('.avs-gloss-block').length).toBe(2);
    reader.close();
  });
});
