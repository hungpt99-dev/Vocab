import { beforeEach, describe, expect, it } from 'vitest';
import { HIGHLIGHT_CLASS, highlightRoot, highlightTextNode, isHighlightableTextNode, removeHighlights, } from './highlighter';
import { VocabularyMatcher } from './matcher';
function entry(word) {
    return { id: word, word, wordKey: word.toLowerCase(), note: 'n', createdAt: 1, meaning: 'm' };
}
const matcher = new VocabularyMatcher([entry('cake'), entry('piece of cake')]);
beforeEach(() => {
    document.body.innerHTML = '';
});
describe('isHighlightableTextNode', () => {
    it('accepts ordinary text', () => {
        document.body.innerHTML = '<p>cake</p>';
        expect(isHighlightableTextNode(document.querySelector('p').firstChild)).toBe(true);
    });
    it('rejects elements and blank text', () => {
        document.body.innerHTML = '<p>   </p>';
        expect(isHighlightableTextNode(document.querySelector('p'))).toBe(false);
        expect(isHighlightableTextNode(document.querySelector('p').firstChild)).toBe(false);
    });
    it('rejects script, style and code content', () => {
        for (const tag of ['script', 'style', 'code', 'textarea']) {
            document.body.innerHTML = `<${tag}>cake</${tag}>`;
            expect(isHighlightableTextNode(document.body.firstElementChild.firstChild)).toBe(false);
        }
    });
    it('rejects contenteditable regions', () => {
        document.body.innerHTML = '<div contenteditable="true">cake</div>';
        const node = document.querySelector('div').firstChild;
        Object.defineProperty(node.parentElement, 'isContentEditable', { value: true });
        expect(isHighlightableTextNode(node)).toBe(false);
    });
    it('rejects text already inside a highlight', () => {
        document.body.innerHTML = `<mark class="${HIGHLIGHT_CLASS}">cake</mark>`;
        expect(isHighlightableTextNode(document.querySelector('mark').firstChild)).toBe(false);
    });
});
describe('highlightTextNode', () => {
    it('wraps matches and preserves surrounding text', () => {
        document.body.innerHTML = '<p>I ate cake today</p>';
        const paragraph = document.querySelector('p');
        expect(highlightTextNode(paragraph.firstChild, matcher)).toBe(1);
        expect(paragraph.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(1);
        expect(paragraph.textContent).toBe('I ate cake today');
    });
    it('adds accessible attributes to each highlight', () => {
        document.body.innerHTML = '<p>cake</p>';
        highlightTextNode(document.querySelector('p').firstChild, matcher);
        const mark = document.querySelector(`.${HIGHLIGHT_CLASS}`);
        expect(mark.getAttribute('role')).toBe('button');
        expect(mark.getAttribute('aria-label')).toContain('cake');
        expect(mark.tabIndex).toBe(0);
    });
    it('returns zero when there is no match', () => {
        document.body.innerHTML = '<p>nothing here</p>';
        expect(highlightTextNode(document.querySelector('p').firstChild, matcher)).toBe(0);
    });
});
describe('highlightRoot', () => {
    it('highlights nested content', () => {
        document.body.innerHTML = '<div><p>cake</p><span>more cake</span></div>';
        expect(highlightRoot(document.body, matcher)).toBe(2);
        expect(document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(2);
    });
    it('skips excluded containers', () => {
        document.body.innerHTML = '<script>cake</script><pre>cake</pre>';
        expect(highlightRoot(document.body, matcher)).toBe(0);
    });
    it('is idempotent across repeated scans', () => {
        document.body.innerHTML = '<p>cake</p>';
        highlightRoot(document.body, matcher);
        highlightRoot(document.body, matcher);
        expect(document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(1);
    });
    it('does nothing with an empty matcher', () => {
        document.body.innerHTML = '<p>cake</p>';
        expect(highlightRoot(document.body, new VocabularyMatcher([]))).toBe(0);
    });
});
describe('removeHighlights', () => {
    it('restores the original text', () => {
        document.body.innerHTML = '<p>I ate cake today</p>';
        highlightRoot(document.body, matcher);
        removeHighlights();
        expect(document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(0);
        expect(document.querySelector('p').textContent).toBe('I ate cake today');
        expect(document.querySelector('p').childNodes).toHaveLength(1);
    });
});
