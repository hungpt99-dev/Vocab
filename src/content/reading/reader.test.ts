import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BilingualReader } from './reader';
import { chromeMock } from '@/test/chrome-mock';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Echo every requested paragraph back with a translated marker. */
function stubTranslate() {
  chromeMock().runtime.sendMessage.mockImplementation(
    async (message: {
      type: string;
      payload?: { paragraphs?: Array<{ id: string; text: string }> };
    }) => {
      if (message.type === 'translate-article') {
        return {
          ok: true,
          data: (message.payload?.paragraphs ?? []).map((paragraph) => ({
            id: paragraph.id,
            text: paragraph.text,
            translation: `译:${paragraph.text}`,
          })),
        };
      }
      return { ok: true, data: undefined };
    },
  );
}

describe('BilingualReader', () => {
  beforeEach(() => {
    document.body.innerHTML = '<article><h1>Title</h1><p>Hello</p><p>World</p></article>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the article as a dialog and fills in translations', async () => {
    stubTranslate();
    const reader = new BilingualReader();
    expect(await reader.open()).toBe(true);
    await flush();

    const overlay = document.querySelector('.avs-reader');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('role')).toBe('dialog');
    expect(overlay?.textContent).toContain('Title');
    expect(overlay?.textContent).toContain('Hello');
    expect(overlay?.textContent).toContain('译:Hello');
    reader.close();
  });

  it('opens nothing and reports false when there is no article content', async () => {
    document.body.innerHTML = '<div></div><nav>only nav</nav><script>void 0;</script>';
    const reader = new BilingualReader();
    expect(await reader.open()).toBe(false);
    expect(document.querySelector('.avs-reader')).toBeNull();
  });

  it('toggles between open and closed', async () => {
    stubTranslate();
    const reader = new BilingualReader();
    expect(await reader.toggle()).toBe(true);
    expect(document.querySelector('.avs-reader')).not.toBeNull();
    await reader.toggle();
    expect(document.querySelector('.avs-reader')).toBeNull();
  });

  it('applies the persisted layout and font size', async () => {
    stubTranslate();
    await chromeMock().storage.local.set({ 'avs:reading': { layout: 'hover', fontSize: 20 } });
    const reader = new BilingualReader();
    await reader.open();

    const overlay = document.querySelector('.avs-reader');
    expect(overlay?.className).toContain('avs-layout-hover');
    expect(document.documentElement.style.getPropertyValue('--avs-reader-font-size')).toBe('20px');
    reader.close();
  });

  it('changes layout through the control', async () => {
    stubTranslate();
    const reader = new BilingualReader();
    await reader.open();

    const select = document.querySelector('.avs-reader-select') as HTMLSelectElement;
    select.value = 'toggle';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(document.querySelector('.avs-reader')?.className).toContain('avs-layout-toggle');
    expect((await chromeMock().storage.local.get('avs:reading'))['avs:reading']).toMatchObject({
      layout: 'toggle',
    });
    reader.close();
  });

  it('shows a retry affordance when a chunk fails and retries on click', async () => {
    chromeMock().runtime.sendMessage
      .mockResolvedValueOnce({ ok: false, error: 'boom' })
      .mockImplementation(
        async (message: { payload?: { paragraphs?: Array<{ id: string; text: string }> } }) => ({
          ok: true,
          data: (message.payload?.paragraphs ?? []).map((paragraph) => ({
            id: paragraph.id,
            text: paragraph.text,
            translation: 'X',
          })),
        }),
      );

    const reader = new BilingualReader();
    await reader.open();
    await flush();

    const errorBar = document.querySelector('.avs-chunk-error');
    expect(errorBar).not.toBeNull();
    errorBar?.querySelector('button')?.click();
    await flush();

    expect(document.querySelector('.avs-chunk-error')).toBeNull();
    expect(document.querySelector('.avs-reader')?.textContent).toContain('X');
    reader.close();
  });

  it('closes on Escape', async () => {
    stubTranslate();
    const reader = new BilingualReader();
    await reader.open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.avs-reader')).toBeNull();
  });

  it('renders one row per sentence in sentence alignment', async () => {
    stubTranslate();
    document.body.innerHTML =
      '<article><p>First sentence here. Second sentence there!</p><p>Another block.</p></article>';
    await chromeMock().storage.local.set({ 'avs:reading': { alignment: 'sentence' } });
    const reader = new BilingualReader();
    await reader.open();

    const overlay = document.querySelector('.avs-reader');
    expect(overlay?.getAttribute('data-align')).toBe('sentence');
    const sections = [...(overlay?.querySelectorAll('.avs-block') ?? [])].map(
      (s) => (s as HTMLElement).dataset.align,
    );
    expect(sections).toEqual(['sentence', 'sentence', 'sentence']);
    const texts = [...(overlay?.querySelectorAll('.avs-block-src') ?? [])].map(
      (s) => s.textContent,
    );
    expect(texts).toEqual(['First sentence here.', 'Second sentence there!', 'Another block.']);
    reader.close();
  });

  it('hides translations when bilingual mode is off', async () => {
    stubTranslate();
    document.body.innerHTML = '<article><p>Hello world.</p></article>';
    await chromeMock().storage.local.set({ 'avs:settings': { bilingualMode: false } });
    const reader = new BilingualReader();
    await reader.open();

    const overlay = document.querySelector('.avs-reader');
    expect(overlay?.getAttribute('data-bilingual')).toBe('off');
    const tgt = document.querySelector('.avs-block-tgt');
    expect(tgt).not.toBeNull();
    expect(tgt).toHaveAttribute('hidden');
    reader.close();
  });
});
