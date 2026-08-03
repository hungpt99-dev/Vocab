import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractArticle } from './extract';

describe('extractArticle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('collects paragraphs and headings in document order', () => {
    document.body.innerHTML = `
      <article>
        <h1>Title</h1>
        <p>First paragraph.</p>
        <p>Second paragraph.</p>
      </article>
    `;

    const blocks = extractArticle();
    expect(blocks.map((b) => b.text)).toEqual(['Title', 'First paragraph.', 'Second paragraph.']);
    expect(blocks[0]?.tagName).toBe('H1');
  });

  it('collects only the shallowest block so nested text is not duplicated', () => {
    document.body.innerHTML = `
      <article>
        <ul><li>Item one</li><li>Item two</li></ul>
        <blockquote><p>Quoted text.</p></blockquote>
      </article>
    `;

    const blocks = extractArticle();
    expect(blocks.map((b) => b.text)).toEqual(['Item one', 'Item two', 'Quoted text.']);
    expect(blocks[1]?.tagName).toBe('LI');
    expect(blocks[2]?.tagName).toBe('BLOCKQUOTE');
  });

  it('skips boilerplate, scripts and hidden regions', () => {
    document.body.innerHTML = `
      <article>
        <p>Visible paragraph.</p>
        <p style="display:none">Hidden paragraph.</p>
        <nav><a>Navigation</a></nav>
        <script>const x = 1;</script>
        <footer><p>Footer</p></footer>
      </article>
    `;

    const blocks = extractArticle();
    expect(blocks.map((b) => b.text)).toEqual(['Visible paragraph.']);
  });

  it('collapses whitespace in each block', () => {
    document.body.innerHTML = `
      <article>
        <p>Hello   world\n and   beyond.</p>
      </article>
    `;
    expect(extractArticle()[0]?.text).toBe('Hello world and beyond.');
  });

  it('returns an empty list when there is no article container or content', () => {
    document.body.innerHTML = '<main></main>';
    expect(extractArticle()).toEqual([]);
  });
});
