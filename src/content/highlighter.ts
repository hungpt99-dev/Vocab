import type { HighlightEntry } from './matcher';
import { VocabularyMatcher } from './matcher';

export const HIGHLIGHT_CLASS = 'avs-highlight';
export const HIGHLIGHT_ATTR = 'data-avs-id';
const PROCESSED_ATTR = 'data-avs-scanned';

const SKIPPED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
  'CODE', 'PRE', 'KBD', 'SVG', 'CANVAS', 'IFRAME', 'HEAD', 'TITLE',
]);

/** True when a text node may safely be rewritten with highlight markup. */
export function isHighlightableTextNode(node: Node): boolean {
  if (node.nodeType !== Node.TEXT_NODE) return false;
  const text = node.nodeValue;
  if (!text || !text.trim()) return false;

  const parent = (node as Text).parentElement;
  if (!parent) return false;
  if (SKIPPED_TAGS.has(parent.tagName)) return false;
  if (parent.isContentEditable) return false;
  if (parent.closest(`.${HIGHLIGHT_CLASS}`)) return false;
  // Never highlight inside our own injected bilingual content or the headbar.
  if (parent.closest('.avs-inline-translation, .avs-inline-control, .avs-bilingual-bar')) return false;
  // Never highlight inside our own UI (toast, toolbar, cards, popovers).
  if (parent.closest('.avs-toast, .avs-toolbar, .avs-assist-menu, .avs-panel, .avs-card')) return false;
  return true;
}

/**
 * Replaces matches inside a single text node with highlight spans.
 * Returns the number of highlights created.
 */
export function highlightTextNode(node: Text, matcher: VocabularyMatcher): number {
  const text = node.nodeValue ?? '';
  const matches = matcher.findAll(text);
  if (matches.length === 0) return 0;

  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) {
      fragment.append(document.createTextNode(text.slice(cursor, match.start)));
    }
    fragment.append(createHighlight(text.slice(match.start, match.end), match.entry));
    cursor = match.end;
  }
  if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));

  node.parentNode?.replaceChild(fragment, node);
  return matches.length;
}

function createHighlight(text: string, entry: HighlightEntry): HTMLElement {
  const mark = document.createElement('mark');
  mark.className = HIGHLIGHT_CLASS;
  mark.textContent = text;
  mark.tabIndex = 0;
  mark.setAttribute(HIGHLIGHT_ATTR, entry.id);
  mark.setAttribute('role', 'button');
  mark.setAttribute('aria-label', `Saved vocabulary: ${entry.word}`);
  return mark;
}

/** Walk a root element and highlight every eligible text node beneath it. */
export function highlightRoot(root: Node, matcher: VocabularyMatcher): number {
  if (matcher.size === 0) return 0;
  if (root.nodeType === Node.ELEMENT_NODE) {
    const element = root as Element;
    if (SKIPPED_TAGS.has(element.tagName)) return 0;
    element.setAttribute(PROCESSED_ATTR, 'true');
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      isHighlightableTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });

  // Collect first: mutating during traversal invalidates the walker.
  const targets: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    targets.push(current as Text);
    current = walker.nextNode();
  }

  return targets.reduce((total, node) => total + highlightTextNode(node, matcher), 0);
}

/** Remove every highlight span, restoring the original text. */
export function removeHighlights(root: ParentNode = document): void {
  for (const mark of root.querySelectorAll(`.${HIGHLIGHT_CLASS}`)) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  }
}
