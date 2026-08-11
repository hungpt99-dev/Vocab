import { afterEach, describe, expect, it, vi } from 'vitest';

// Bilingual reading always uses keyless Google Translate (independent of the
// user's AI key). Mock the googleTranslate module directly — that is now the
// only dependency of TranslateService.translate/alignWords.
vi.mock('./google-translate', () => ({
  googleTranslate: {
    translate: vi.fn(async (paragraphs: string[]) =>
      paragraphs.map((p) => `[vi]${p}`),
    ),
    align: vi.fn(async (paragraphs: Array<{ id: string; text: string }>) =>
      paragraphs.map((p) => ({
        id: p.id,
        text: p.text,
        pairs: p.text.split(/\s+/).map((w) => ({ source: w, target: `[vi]${w}` })),
        translation: `[vi]${p.text}`,
      })),
    ),
  },
}));

import { TranslateService } from './translate-service';
import { SettingsRepository } from '@/storage/settings-repository';
import { googleTranslate } from './google-translate';

const google = googleTranslate as unknown as {
  translate: ReturnType<typeof vi.fn>;
  align: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  vi.unstubAllGlobals();
  google.translate.mockClear();
  google.align.mockClear();
});

/** A provider config (content irrelevant now — bilingual never uses it). */
function noKeySettings() {
  const settings = new SettingsRepository();
  return settings.update({
    providers: [
      { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'sk-test', baseUrl: '', model: '', enabled: true },
    ],
    activeProviderId: 'p1',
  });
}

describe('TranslateService (bilingual = keyless Google)', () => {
  it('translates paragraphs through Google, ignoring the AI provider', async () => {
    const settings = new SettingsRepository();
    await noKeySettings();
    void settings;

    const result = await new TranslateService().translate(
      [
        { id: 'a', text: 'Hello' },
        { id: 'b', text: 'World' },
      ],
      'Vietnamese',
    );

    expect(google.translate).toHaveBeenCalled();
    expect(result).toMatchObject([
      { id: 'a', text: 'Hello', translation: '[vi]Hello' },
      { id: 'b', text: 'World', translation: '[vi]World' },
    ]);
  });

  it('aligns words through Google, producing per-word glosses', async () => {
    await noKeySettings();

    const result = await new TranslateService().alignWords(
      [{ id: 'a', text: 'Hello world' }],
      'Vietnamese',
    );

    expect(google.align).toHaveBeenCalled();
    expect(result[0]?.pairs).toEqual([
      { source: 'Hello', target: '[vi]Hello' },
      { source: 'world', target: '[vi]world' },
    ]);
  });

  it('caches translations so a re-render does not re-hit the network', async () => {
    await noKeySettings();
    const service = new TranslateService();
    const paragraphs = [{ id: 'a', text: 'Hello' }];
    await service.alignWords(paragraphs, 'Vietnamese');
    google.align.mockClear();
    await service.alignWords(paragraphs, 'Vietnamese');
    expect(google.align).toHaveBeenCalledTimes(0);
  });

  it('re-keys cached align results to the caller ids (two tabs, same article)', async () => {
    await noKeySettings();
    const service = new TranslateService();
    // Tab 1 reads the article; its (random) block ids end up in the cache.
    await service.alignWords([{ id: 'tab1-block', text: 'Hello world' }], 'Vietnamese');
    google.align.mockClear();
    // Tab 2 reads the same article: text matches the cache, ids differ. The
    // cached results must be re-keyed to tab 2's ids or its reader injects
    // nothing (every lookup misses) — the real bug behind "second tab blank".
    const result = await service.alignWords([{ id: 'tab2-block', text: 'Hello world' }], 'Vietnamese');
    expect(google.align).toHaveBeenCalledTimes(0);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('tab2-block');
    expect(result[0]?.pairs).toEqual([
      { source: 'Hello', target: '[vi]Hello' },
      { source: 'world', target: '[vi]world' },
    ]);
  });

  it('chunks long articles across multiple Google calls in order', async () => {
    await noKeySettings();
    const paragraphs = Array.from({ length: 20 }, (_, index) => ({ id: `p${index}`, text: `Para ${index}` }));
    const result = await new TranslateService().translate(paragraphs, 'Vietnamese');

    // CHUNK_SIZE is 16 → 20 paragraphs span two chunks.
    expect(google.translate).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(20);
    expect(result[0]).toMatchObject({ id: 'p0', text: 'Para 0', translation: '[vi]Para 0' });
    expect(result[15]).toMatchObject({ id: 'p15', text: 'Para 15', translation: '[vi]Para 15' });
    expect(result[16]).toMatchObject({ id: 'p16', text: 'Para 16', translation: '[vi]Para 16' });
    expect(result[19]).toMatchObject({ id: 'p19', text: 'Para 19', translation: '[vi]Para 19' });
  });

  it('serves repeated requests from the cache', async () => {
    await noKeySettings();
    const service = new TranslateService();
    await service.translate([{ id: 'a', text: 'Hello' }], 'Vietnamese');
    google.translate.mockClear();
    await service.translate([{ id: 'a', text: 'Hello' }], 'Vietnamese');
    expect(google.translate).toHaveBeenCalledTimes(0);
  });

  it('attaches a BilingualPerf breakdown to the first result for debug logging', async () => {
    await noKeySettings();
    const result = await new TranslateService().translate(
      [
        { id: 'a', text: 'Hello' },
        { id: 'b', text: 'World' },
      ],
      'Vietnamese',
    );

    expect(result[0]?.perf).toBeDefined();
    expect(result[0]?.perf).toMatchObject({
      chunks: 1,
      cacheHits: 0,
      rateLimitWaitMs: 0,
      providerMs: expect.any(Number),
      totalMs: expect.any(Number),
    });
  });
});
