import { collapseWhitespace } from '@/shared/lib/text';

/** Block elements that never belong to the article body. */
const SKIPPED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
  'CODE', 'PRE', 'KBD', 'SVG', 'CANVAS', 'IFRAME', 'HEAD', 'TITLE',
  'BUTTON', 'NAV', 'FOOTER', 'HEADER', 'ASIDE', 'FORM', 'FIGURE',
]);

/** Elements treated as a translatable block of the article. */
const BLOCK_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'FIGCAPTION', 'DT', 'DD', 'TD', 'TH', 'SUMMARY',
]);

/**
 * Stable IDs per DOM element. `extractArticle()` is called repeatedly (tab
 * re-focus, SPA nav, settings refresh) and the reader dedupes already-translated
 * blocks by `block.id`. If IDs were random (createId), each re-extract would
 * produce brand-new IDs, so every block would look "new" and the translation
 * would be injected a SECOND time — duplicating the whole page. Keying the ID
 * to the element (WeakMap, so it doesn't leak) keeps IDs identical across
 * re-extracts, so the dedup guard correctly skips blocks we already translated.
 */
const blockIds = new WeakMap<Element, string>();
let blockIdCounter = 0;
function blockIdFor(element: Element): string {
  const existing = blockIds.get(element);
  if (existing) return existing;
  blockIdCounter += 1;
  const id = `b${blockIdCounter}`;
  blockIds.set(element, id);
  return id;
}

/** A single translatable block: original element plus its collapsed text. */
export interface ArticleBlock {
  id: string;
  text: string;
  /** Source tag name, preserved so headings keep their heading semantics. */
  tagName: string;
  element: Element;
}

/** True when the element is actually rendered (not `display:none` etc.). */
export function isVisible(element: Element): boolean {
  if (typeof element.checkVisibility === 'function') return element.checkVisibility();
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/**
 * Find the article container: the first of `article`, `main`, `[role="main"]`
 * or the document body as a fallback.
 */
export function findArticleContainer(doc: Document = document): Element | null {
  return (
    doc.querySelector('article') ??
    doc.querySelector('main') ??
    doc.querySelector('[role="main"]') ??
    doc.body
  );
}

/**
 * Extract the article as a flat list of text-bearing blocks in document order.
 * The shallowest block element wins, so paragraphs nested inside a list item or
 * blockquote are not double-collected, and boilerplate (nav, footer, scripts,
 * hidden regions) is skipped. Text nodes are whitespace-collapsed like the rest
 * of the extension.
 */
export function extractArticle(doc: Document = document): ArticleBlock[] {
  const root = findArticleContainer(doc);
  if (!root) return [];

  const blocks: ArticleBlock[] = [];
  collectBlocks(root, blocks);
  return blocks;
}

function collectBlocks(root: Element, out: ArticleBlock[]): void {
  for (const child of root.children) {
    if (SKIPPED_TAGS.has(child.tagName)) continue;
    // Skip the extension's own injected nodes (the bilingual translation lines,
    // the control/headbar, gloss words, …). If we didn't, a re-extract (tab
    // re-focus, SPA nav, settings refresh) would treat the injected
    // translations as NEW source paragraphs and translate them AGAIN, doubling
    // the page every time the user switched tabs or navigated in-site.
    if (child.classList.contains('avs-inline-translation')) continue;
    if (child.classList.contains('avs-inline-control')) continue;
    if (child.closest('.avs-bilingual-control, .avs-inline-control')) continue;

    // Known block tags (p, headings, li, …) are collected directly.
    if (BLOCK_TAGS.has(child.tagName)) {
      const text = collapseWhitespace(child.textContent ?? '');
      if (text && isVisible(child)) {
        out.push({ id: blockIdFor(child), text, tagName: child.tagName, element: child });
      }
      continue;
    }

    // Not a known block tag: if it wraps a nested block (e.g. a <div> holding a
    // <p>), recurse so we keep the shallowest block. Otherwise, if it carries
    // direct text, treat the container itself as a block — this is how modern
    // SPA/docs sites (React, Next.js, Docusaurus, …) render prose, so skipping
    // it would leave whole passages untranslated.
    if (containsBlockTag(child)) {
      collectBlocks(child, out);
      continue;
    }
    const text = collapseWhitespace(child.textContent ?? '');
    if (text && isVisible(child)) {
      out.push({ id: blockIdFor(child), text, tagName: child.tagName, element: child });
    }
  }
}

/** True when any descendant (excluding the element itself) is a known block tag. */
function containsBlockTag(element: Element): boolean {
  for (const tag of BLOCK_TAGS) {
    if (element.querySelector(tag)) return true;
  }
  return false;
}
