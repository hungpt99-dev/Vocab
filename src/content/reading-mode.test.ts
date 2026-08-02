import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  READING_MODE_LAYOUTS,
  ReadingMode,
  extractReadableContent,
  type ReadableContent,
  type TranslateBlocks,
} from './reading-mode';

function fixtureDoc(): Document {
  const doc = document.implementation.createHTMLDocument('fixture');
  doc.body.innerHTML = `
    <nav><p>Skip me</p></nav>
    <article>
      <h1>Reading Mode</h1>
      <p>First paragraph of the article.</p>
      <h2>Section</h2>
      <p>Second paragraph with <code>code</code> inside.</p>
      <blockquote><p>A nested quote.</p></blockquote>
    </article>
  `;
  return doc;
}

const content: ReadableContent = {
  title: 'Reading Mode',
  blocks: [
    { kind: 'paragraph', text: 'First paragraph of the article.' },
    { kind: 'heading', text: 'Section' },
    { kind: 'paragraph', text: 'Second paragraph.' },
  ],
};

describe('extractReadableContent', () => {
  it('returns the title and top-level blocks, skipping nav', () => {
    const result = extractReadableContent(fixtureDoc());
    expect(result.title).toBe('Reading Mode');
    expect(result.blocks).toEqual([
      { kind: 'paragraph', text: 'First paragraph of the article.' },
      { kind: 'heading', text: 'Section' },
      { kind: 'paragraph', text: 'Second paragraph with code inside.' },
      { kind: 'paragraph', text: 'A nested quote.' },
    ]);
  });

  it('respects the block cap', () => {
    const result = extractReadableContent(fixtureDoc(), 2);
    expect(result.blocks).toHaveLength(2);
  });

  it('falls back to the largest container when there is no article', () => {
    const doc = document.implementation.createHTMLDocument('bare');
    doc.body.innerHTML = '<main><h1>Lonely</h1><p>Some prose.</p></main>';
    const result = extractReadableContent(doc);
    expect(result.title).toBe('Lonely');
    expect(result.blocks).toEqual([{ kind: 'paragraph', text: 'Some prose.' }]);
  });
});

describe('ReadingMode', () => {
  let translate: ReturnType<typeof vi.fn<TranslateBlocks>>;

  beforeEach(() => {
    document.body.innerHTML = '';
    translate = vi.fn(async (blocks: string[]) => blocks.map((block) => `translated: ${block}`));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('opens an overlay with the title, blocks and five layout options', () => {
    const mode = new ReadingMode(translate);
    mode.open(content);

    const overlay = document.getElementById('avs-reading-mode');
    expect(overlay).not.toBeNull();
    expect(overlay!.getAttribute('role')).toBe('dialog');
    expect(overlay!.querySelector('.avs-reading-title')?.textContent).toBe('Reading Mode');
    expect(overlay!.querySelectorAll('.avs-reading-block')).toHaveLength(3);
    expect(overlay!.querySelectorAll('#avs-reading-layout option')).toHaveLength(5);
    expect(mode.isOpen).toBe(true);
    mode.close();
  });

  it('does not open when already open', () => {
    const mode = new ReadingMode(translate);
    mode.open(content);
    mode.open(content);
    expect(document.querySelectorAll('#avs-reading-mode')).toHaveLength(1);
    mode.close();
  });

  it('renders translations returned for each block', async () => {
    const mode = new ReadingMode(translate);
    mode.open(content);
    await vi.waitFor(() => {
      const cells = document.querySelectorAll('.avs-reading-translation');
      expect(cells[0]?.textContent).toBe('translated: First paragraph of the article.');
      expect(cells[1]?.textContent).toBe('translated: Section');
    });
    mode.close();
  });

  it('marks blocks whose translation failed as unavailable', async () => {
    translate.mockResolvedValue(['ok', null, 'ok']);
    const mode = new ReadingMode(translate);
    mode.open(content);
    await vi.waitFor(() => {
      const cells = document.querySelectorAll('.avs-reading-translation');
      expect(cells[1]?.textContent).toBe('Translation unavailable');
      expect(cells[1]?.getAttribute('data-status')).toBe('error');
    });
    mode.close();
  });

  it('shows a status banner when the whole request fails', async () => {
    translate.mockRejectedValue(new Error('no provider'));
    const mode = new ReadingMode(translate);
    mode.open(content);
    await vi.waitFor(() => {
      const banner = document.querySelector<HTMLElement>('.avs-reading-status');
      expect(banner?.hidden).toBe(false);
      expect(banner?.textContent).toContain('Translation unavailable');
    });
    mode.close();
  });

  it('switches layouts instantly via the blocks container state', () => {
    const mode = new ReadingMode(translate);
    mode.open(content);

    const container = document.querySelector('.avs-reading-blocks') as HTMLElement;
    expect(container.dataset.layout).toBe('side-by-side');

    mode.setLayout('hover-translation');
    expect(container.dataset.layout).toBe('hover-translation');

    mode.setLayout('toggle-translation');
    expect(container.dataset.layout).toBe('toggle-translation');
    mode.close();
  });

  it('exposes every layout as selectable', () => {
    expect(READING_MODE_LAYOUTS).toEqual([
      'side-by-side',
      'original-first',
      'translation-first',
      'hover-translation',
      'toggle-translation',
    ]);
  });

  it('toggles translations only in toggle-translation layout', () => {
    const mode = new ReadingMode(translate);
    mode.open(content);
    const container = document.querySelector('.avs-reading-blocks') as HTMLElement;

    mode.toggleTranslations();
    expect(container.dataset.showTranslation).toBe('false');

    mode.setLayout('toggle-translation');
    mode.toggleTranslations();
    expect(container.dataset.showTranslation).toBe('true');
    expect(document.querySelector('.avs-reading-toggle')).not.toBeNull();
    mode.close();
  });

  it('closes by removing the overlay from the document', () => {
    const mode = new ReadingMode(translate);
    mode.open(content);
    expect(mode.isOpen).toBe(true);

    mode.close();
    expect(mode.isOpen).toBe(false);
    expect(document.getElementById('avs-reading-mode')).toBeNull();
  });
});
