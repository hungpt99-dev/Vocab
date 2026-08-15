import { describe, expect, it } from 'vitest';
import { extractArticle } from './extract';

function render(html: string): void {
  document.body.innerHTML = html;
}

describe('extractArticle', () => {
  it('collects standard block elements (p, headings, li)', () => {
    render(`
      <main>
        <h1>Title</h1>
        <p>First paragraph.</p>
        <ul><li>An item</li></ul>
      </main>
    `);
    const blocks = extractArticle();
    const texts = blocks.map((block) => block.text);
    expect(texts).toContain('Title');
    expect(texts).toContain('First paragraph.');
    expect(texts).toContain('An item');
  });

  it('collects prose rendered in plain div/section containers (SPA docs sites)', () => {
    render(`
      <article>
        <div>This is a paragraph rendered in a plain div without a <strong>p</strong> tag.</div>
        <section><p>Nested real paragraph.</p></section>
        <div><div>Deeply nested prose with no block tags.</div></div>
      </article>
    `);
    const blocks = extractArticle();
    const texts = blocks.map((block) => block.text);
    // The plain-div prose must NOT be skipped just because there is no <p>.
    expect(texts).toContain(
      'This is a paragraph rendered in a plain div without a p tag.',
    );
    expect(texts).toContain('Nested real paragraph.');
    expect(texts).toContain('Deeply nested prose with no block tags.');
  });

  it('does not double-collect when a container wraps a real block', () => {
    render(`
      <main>
        <div><p>Only once</p></div>
      </main>
    `);
    const blocks = extractArticle();
    const matches = blocks.filter((block) => block.text === 'Only once');
    expect(matches).toHaveLength(1);
  });

  it('skips hidden and boilerplate regions', () => {
    render(`
      <main>
        <p>Visible text.</p>
        <div style="display:none">Hidden text.</div>
        <nav>Nav link</nav>
      </main>
    `);
    const texts = extractArticle().map((block) => block.text);
    expect(texts).toContain('Visible text.');
    expect(texts).not.toContain('Hidden text.');
    expect(texts).not.toContain('Nav link');
  });

  it('assigns STABLE ids keyed to the DOM element across re-extracts', () => {
    render(`<main><p>One.</p><p>Two.</p></main>`);
    const first = extractArticle();
    const second = extractArticle();
    expect(first.map((b) => b.id)).toEqual(second.map((b) => b.id));
    // The same element must keep the same id; a fresh element gets a new one.
    const p = document.querySelector('p')!;
    expect(first[0]?.id).toBe(second[0]?.id);
    expect(first[0]?.element).toBe(p);
  });
});
