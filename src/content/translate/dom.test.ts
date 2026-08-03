import { beforeEach, describe, expect, it } from 'vitest';
import { collectTranslationUnits, type TranslationUnit } from './dom';

function setBody(html: string): void {
  document.body.innerHTML = html;
}

function units(): TranslationUnit[] {
  return collectTranslationUnits(document.body);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('collectTranslationUnits', () => {
  it('makes each paragraph a unit', () => {
    setBody('<p>Hello world.</p><p>Second paragraph.</p>');
    const collected = units();
    expect(collected).toHaveLength(2);
    expect(collected[0]?.source).toBe('Hello world.');
    expect(collected[1]?.source).toBe('Second paragraph.');
  });

  it('treats headings, list items and table cells as units', () => {
    setBody('<h1>Title</h1><ul><li>One</li><li>Two</li></ul><table><tr><td>Cell</td></tr></table>');
    const collected = units();
    expect(collected.map((unit) => unit.source)).toEqual([
      'Title',
      'One',
      'Two',
      'Cell',
    ]);
  });

  it('translates nested blocks individually, never the container', () => {
    setBody('<div><p>First.</p><p>Second.</p></div>');
    const collected = units();
    expect(collected).toHaveLength(2);
    expect(collected.map((unit) => unit.source)).toEqual(['First.', 'Second.']);
  });

  it('captures bare text directly under the root', () => {
    setBody('Loose text.');
    const collected = units();
    expect(collected).toHaveLength(1);
    expect(collected[0]?.source).toBe('Loose text.');
  });

  it('captures bare text mixed with blocks under a container', () => {
    setBody('<div>Intro.<p>Body.</p></div>');
    const collected = units();
    expect(collected.map((unit) => unit.source)).toEqual(['Intro.', 'Body.']);
  });

  it('skips script, style, pre and code content', () => {
    setBody('<script>var x = 1;</script><pre>const a = 1;</pre><p>Code: <code>npm test</code>.</p>');
    const collected = units();
    expect(collected).toHaveLength(1);
    expect(collected[0]?.source).toBe('Code: [[0]].');
  });

  it('skips the extension\'s own injected nodes', () => {
    setBody('<p>Before <mark class="avs-highlight">cake</mark> after.</p>');
    const collected = units();
    expect(collected).toHaveLength(1);
    expect(collected[0]?.source).toBe('Before [[0]]after.');
  });

  it('skips contenteditable regions', () => {
    setBody('<div contenteditable="true">Editable text.</div>');
    expect(units()).toHaveLength(0);
  });

  it('skips elements with no translatable text', () => {
    setBody('<div></div><p>   </p>');
    expect(units()).toHaveLength(0);
  });

  it('skips a unit whose text contains a literal placeholder marker', () => {
    setBody('<p>See docs [[1]] for details.</p>');
    expect(units()).toHaveLength(0);
  });

  it('places markers between inline elements, preserving their order', () => {
    setBody('<p>Alpha <b>bold</b> <a href="/x">link</a> end.</p>');
    const collected = units();
    expect(collected).toHaveLength(1);
    expect(collected[0]?.source).toBe('Alpha [[0]]bold [[1]]link [[2]]end.');
  });
});

describe('TranslationUnit.apply', () => {
  it('replaces text-node content and preserves tags and attributes', () => {
    setBody('<h2 id="intro">Hello <a href="/wiki">world</a>!</h2>');
    const unit = units()[0]!;

    expect(unit.apply('Bonjour [[0]]monde [[1]]!')).toBe(true);

    const heading = document.querySelector('h2')!;
    expect(heading.getAttribute('id')).toBe('intro');
    expect(heading.querySelector('a')?.getAttribute('href')).toBe('/wiki');
    expect(heading.textContent).toBe('Bonjour monde !');
    expect(heading.childNodes).toHaveLength(3);
  });

  it('updates each text node independently around inline markup', () => {
    setBody('<p>Red <em>green</em> blue.</p>');
    const unit = units()[0]!;
    unit.apply('Rouge [[0]]vert [[1]]bleu.');
    expect(document.querySelector('p')?.textContent).toBe('Rouge vert bleu.');
    expect(document.querySelector('em')?.textContent).toBe('vert ');
  });

  it('refuses to apply when placeholders are not preserved', () => {
    setBody('<p>One <a href="#">two</a>.</p>');
    const unit = units()[0]!;
    expect(unit.apply('Uno dos.')).toBe(false);
    expect(document.querySelector('p')?.textContent).toBe('One two.');
  });

  it('translates a single text node in place', () => {
    setBody('Plain text.');
    const unit = units()[0]!;
    expect(unit.apply('Texte simple.')).toBe(true);
    expect(document.body.firstChild?.nodeValue).toBe('Texte simple.');
  });
});
