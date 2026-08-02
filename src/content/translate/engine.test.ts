import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectTranslationUnits } from './dom';
import { translatePage, translateUnits } from './engine';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('translatePage', () => {
  it('translates each paragraph in place', async () => {
    document.body.innerHTML = '<p>Hello.</p><p>World.</p>';
    const translate = vi.fn(async (source: string) => `TR:${source}`);

    const result = await translatePage(document.body, { translate });

    expect(translate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ translated: 2, skipped: 0 });
    expect(document.body.textContent).toBe('TR:Hello.TR:World.');
  });

  it('continues after a failed unit and surfaces its error', async () => {
    document.body.innerHTML = '<p>One.</p><p>Two.</p>';
    const translate = vi.fn(async (source: string) => {
      if (source === 'One.') throw new Error('quota exceeded');
      return `TR:${source}`;
    });

    const result = await translatePage(document.body, { translate, concurrency: 1 });

    expect(result).toMatchObject({ translated: 1, skipped: 1, error: 'quota exceeded' });
    expect(document.body.textContent).toBe('One.TR:Two.');
  });

  it('stops translating once cancelled', async () => {
    document.body.innerHTML = '<p>One.</p><p>Two.</p><p>Three.</p>';
    let cancelled = false;
    const translate = vi.fn(async (source: string) => {
      if (source === 'Two.') cancelled = true;
      return `TR:${source}`;
    });

    const result = await translatePage(document.body, {
      translate,
      concurrency: 1,
      isCancelled: () => cancelled,
    });

    // "Two." is translated but flagged cancelled before applying; "Three." never runs.
    expect(translate).toHaveBeenCalledTimes(2);
    expect(result.translated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(document.body.textContent).toBe('TR:One.Two.Three.');
  });

  it('skips a unit whose translation loses the markup markers', async () => {
    document.body.innerHTML = '<p>Keep <b>markup</b>.</p>';
    const translate = vi.fn(async () => 'translated without markers');

    const result = await translatePage(document.body, { translate });

    expect(result).toEqual({ translated: 0, skipped: 1 });
    expect(document.body.textContent).toBe('Keep markup.');
  });
});

describe('translateUnits', () => {
  it('respects the concurrency cap', async () => {
    document.body.innerHTML = '<p>A</p><p>B</p><p>C</p><p>D</p>';
    const units = collectTranslationUnits(document.body);
    let inFlight = 0;
    let maxInFlight = 0;
    const translate = vi.fn(async (source: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return `TR:${source}`;
    });

    await translateUnits(units, { translate, concurrency: 2 });

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(translate).toHaveBeenCalledTimes(4);
  });
});
