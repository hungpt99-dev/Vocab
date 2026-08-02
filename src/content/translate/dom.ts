/**
 * DOM traversal for structured page translation.
 *
 * The page is split into translation units — paragraph-sized blocks (headings,
 * paragraphs, list items, table cells, …). Each unit's readable text is built
 * from its text nodes joined by `[[n]]` placeholders, one per inline-element
 * boundary. The AI translates around the placeholders; `apply` then splits the
 * translated text back onto the original text nodes, so every tag and
 * attribute survives untouched and the page layout is never disturbed.
 *
 * Code blocks, scripts, form controls and the extension's own nodes are never
 * touched.
 */

const SKIPPED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'CODE',
  'PRE',
  'KBD',
  'SVG',
  'CANVAS',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'HEAD',
  'TITLE',
]);

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'CAPTION',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HGROUP',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
]);

/** The extension's own injected nodes; their content is never translated. */
const OWN_SELECTOR = '.avs-highlight, .avs-card, .avs-toast, .avs-toolbar';

const EDITABLE_SELECTOR =
  '[contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable=""]';

const SKIPPED_TAG_SELECTOR = [...SKIPPED_TAGS].map((tag) => tag.toLowerCase()).join(',');

/** `[[n]]` markers anchor inline markup and must be preserved by the model. */
const PLACEHOLDER_PATTERN = /\[\[[0-9]+\]\]/;
const PLACEHOLDER_SPLIT = /\[\[[0-9]+\]\]/;

export interface TranslationUnit {
  /** The element owning the unit, or the text node for a bare-text unit. */
  root: Node;
  /** The text nodes the translation is distributed across, in document order. */
  textNodes: readonly Text[];
  /** Whitespace-collapsed text with `[[n]]` markers, sent to the AI. */
  source: string;
  /**
   * Replace the text-node content with the AI translation. Returns false when
   * the model failed to preserve every placeholder — the unit is left as-is.
   */
  apply(translated: string): boolean;
}

/** Walk the DOM and collect every translatable unit below `root`. */
export function collectTranslationUnits(root: ParentNode): TranslationUnit[] {
  const units: TranslationUnit[] = [];
  for (const child of root.childNodes) {
    collectNode(child, units);
  }
  return units;
}

function collectNode(node: Node, units: TranslationUnit[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    if ((node.nodeValue ?? '').trim()) units.push(buildTextUnit(node as Text));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as Element;
  if (shouldSkipElement(element)) return;

  // A block element with no nested block is a single unit (its inline children
  // are preserved via placeholders). Containers recurse so nested blocks — the
  // paragraphs inside a section, the items of a list — are translated per block.
  if (isBlockElement(element) && !hasBlockDescendant(element)) {
    const unit = buildElementUnit(element);
    if (unit) units.push(unit);
    return;
  }

  for (const child of element.childNodes) {
    collectNode(child, units);
  }
}

function buildElementUnit(element: Element): TranslationUnit | null {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const text = node.nodeValue ?? '';
      if (!text.trim()) return NodeFilter.FILTER_REJECT;
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (isInEditable(parent)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(SKIPPED_TAG_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(OWN_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }
  if (textNodes.length === 0) return null;

  const source = buildSource(textNodes);
  if (source === null) return null;

  return {
    root: element,
    textNodes,
    source,
    apply: (translated) => applyTranslation(textNodes, translated),
  };
}

function buildTextUnit(node: Text): TranslationUnit {
  return {
    root: node,
    textNodes: [node],
    source: (node.nodeValue ?? '').trim(),
    apply: (translated) => applyTranslation([node], translated),
  };
}

/**
 * Join the unit's text nodes into one readable string with `[[n]]` markers
 * between consecutive nodes. Returns null when the source text already contains
 * a literal `[[n]]` marker, which would make the round-trip ambiguous.
 */
function buildSource(textNodes: readonly Text[]): string | null {
  const chunks: string[] = [];
  for (const node of textNodes) {
    const chunk = (node.nodeValue ?? '').trim();
    if (PLACEHOLDER_PATTERN.test(chunk)) return null;
    chunks.push(chunk);
  }

  return chunks
    .map((chunk, index) => (index === chunks.length - 1 ? chunk : `${chunk} [[${index}]]`))
    .join('');
}

/**
 * Distribute the translated text back onto the unit's text nodes. Requires the
 * model to have reproduced every placeholder exactly, so the chunk count always
 * matches; otherwise nothing is changed.
 */
function applyTranslation(textNodes: readonly Text[], translated: string): boolean {
  const parts = translated.split(PLACEHOLDER_SPLIT);
  if (parts.length !== textNodes.length) return false;

  textNodes.forEach((node, index) => {
    node.nodeValue = parts[index] ?? '';
  });
  return true;
}

function shouldSkipElement(element: Element): boolean {
  if (SKIPPED_TAGS.has(element.tagName)) return true;
  if (isInEditable(element)) return true;
  if (element.closest(OWN_SELECTOR)) return true;
  return false;
}

/** True inside a contenteditable region (self or an ancestor). */
function isInEditable(element: Element): boolean {
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return element.closest(EDITABLE_SELECTOR) !== null;
}

function isBlockElement(element: Element): boolean {
  return BLOCK_TAGS.has(element.tagName);
}

/** True when `element` contains a translatable block element further down. */
function hasBlockDescendant(element: Element): boolean {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const el = node as Element;
      if (el === element) return NodeFilter.FILTER_REJECT;
      if (SKIPPED_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
      return isBlockElement(el) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  return walker.nextNode() !== null;
}
