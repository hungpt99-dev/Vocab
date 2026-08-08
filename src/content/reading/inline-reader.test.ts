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
    // Default IntersectionObserver: report every observed element as intersecting
    // (jsdom has no layout). This makes open() translate all blocks eagerly,
    // matching the historical behaviour the other tests rely on. Individual
    // tests can override this with a non-auto-firing mock.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private readonly cb: IntersectionObserverCallback) {}
        observe(el: Element): void {
          this.cb([{ target: el, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
        }
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      } as unknown as typeof IntersectionObserver,
    );
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

  it('translates lazily — only in-view blocks initially, more as they intersect', async () => {
    // A long article: many paragraphs, far more than one viewport.
    const paragraphs = Array.from({ length: 40 }, (_, i) => `<p id="p${i}">Paragraph number ${i} about linguistics</p>`).join('');
    document.body.innerHTML = `<article>${paragraphs}</article>`;

    // jsdom has no layout, so getBoundingClientRect returns zeros and nothing is
    // "near visible" on open — translation must come solely from the observer.
    // Force a zero-height viewport so the "near visible" heuristic sees nothing
    // as visible on open() — translation must come solely from the observer.
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 0 });

    const observers: Array<{ cb: IntersectionObserverCallback; elements: Element[] }> = [];
    class MockIO {
      public elements: Element[] = [];
      constructor(public cb: IntersectionObserverCallback) {
        observers.push({ cb, elements: this.elements });
      }
      observe(el: Element): void {
        this.elements.push(el);
      }
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver);

    // align-words echoes the requested paragraphs (resolved immediately).
    vi.mocked(sendMessage).mockImplementation(async (message) => {
      if (message.type === 'align-words') {
        const paragraphsReq = message.payload.paragraphs as Array<{ id: string; text: string }>;
        return paragraphsReq.map((paragraph) => ({
          id: paragraph.id,
          text: paragraph.text,
          pairs: [{ source: 'linguistics', target: 'ngôn ngữ học' }],
          translation: `[vi]${paragraph.text}`,
        })) as never;
      }
      return [] as never;
    });

    const reader = new InlineReader();
    await reader.open();
    await flush();
    await flush();

    // Nothing translated yet — the page was NOT loaded all at once.
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(0);

    const observer = observers[0]!;
    const firstEl = document.getElementById('p0')!;
    const lastEl = document.getElementById('p39')!;

    // Simulate the top block scrolling into view.
    await observer.cb(
      [{ target: firstEl, isIntersecting: true } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await flush();
    await flush();
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(1);

    // Simulate the last block intersecting.
    await observer.cb(
      [{ target: lastEl, isIntersecting: true } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await flush();
    await flush();
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(2);

    // Re-intersecting the same block must NOT re-translate it.
    await observer.cb(
      [{ target: firstEl, isIntersecting: true } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await flush();
    await flush();
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(2);

    reader.close();
  });

  it('shows a persistent banner when the AI call fails (no silent monolingual page)', async () => {
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

    const banner = document.querySelector('.avs-bilingual-banner');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('API key');
    reader.close();
    expect(document.querySelector('.avs-bilingual-banner')).toBeNull();
  });

  it('shows a skeleton while a block translates, then replaces it with the line', async () => {
    const reader = new InlineReader();
    // Keep the align response pending so we can observe the loading state.
    void reader.open();
    await flush();

    // While the request is in flight, a shimmering skeleton placeholder is shown.
    expect(document.querySelectorAll('.avs-skeleton-line').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(0);

    // The translation arrives.
    resolveSend(glossResponse());
    await flush();
    await flush();

    // Skeleton is gone; the real translation line took its place.
    expect(document.querySelectorAll('.avs-skeleton-line').length).toBe(0);
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(2);
    reader.close();
  });

  it('removes skeleton placeholders when closed mid-flight (no orphaned shimmer)', async () => {
    const reader = new InlineReader();
    // Start open() but keep the align response pending so skeletons are showing.
    void reader.open();
    await flush();

    expect(document.querySelectorAll('.avs-skeleton-line').length).toBeGreaterThan(0);

    // Turn bilingual off WHILE the batch is still translating.
    reader.close();

    // The pending response arrives after close — must not re-add anything.
    resolveSend(glossResponse());
    await flush();
    await flush();

    // No skeleton shimmer and no injected lines remain on the page.
    expect(document.querySelectorAll('.avs-skeleton-line').length).toBe(0);
    expect(document.querySelectorAll('.avs-inline-translation').length).toBe(0);
    expect(document.querySelectorAll('.avs-gloss-word').length).toBe(0);
  });
});
