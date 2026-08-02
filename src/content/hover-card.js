const CARD_ID = 'avs-hover-card';
const OFFSET = 10;
/** Format an epoch timestamp for display in the hover card. */
export function formatSavedDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
/**
 * Compute a viewport-clamped position for the card, flipping above the anchor
 * when there is not enough space below.
 */
export function computePosition(anchor, card, viewport) {
    const fitsBelow = anchor.bottom + OFFSET + card.height <= viewport.height;
    const top = fitsBelow ? anchor.bottom + OFFSET : Math.max(OFFSET, anchor.top - OFFSET - card.height);
    const maxLeft = Math.max(OFFSET, viewport.width - card.width - OFFSET);
    const left = Math.min(Math.max(OFFSET, anchor.left), maxLeft);
    return { top, left };
}
/** Accessible tooltip showing the meaning, note and saved date of an entry. */
export class HoverCard {
    element = null;
    ensureElement() {
        if (this.element?.isConnected)
            return this.element;
        const card = document.createElement('div');
        card.id = CARD_ID;
        card.className = 'avs-card';
        card.setAttribute('role', 'tooltip');
        card.hidden = true;
        document.body.append(card);
        this.element = card;
        return card;
    }
    show(anchor, entry) {
        const card = this.ensureElement();
        card.replaceChildren(...renderContent(entry));
        card.hidden = false;
        anchor.setAttribute('aria-describedby', CARD_ID);
        const anchorRect = anchor.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const { top, left } = computePosition(anchorRect, { width: cardRect.width, height: cardRect.height }, { width: window.innerWidth, height: window.innerHeight });
        card.style.top = `${top}px`;
        card.style.left = `${left}px`;
    }
    hide(anchor) {
        anchor?.removeAttribute('aria-describedby');
        if (this.element)
            this.element.hidden = true;
    }
    destroy() {
        this.element?.remove();
        this.element = null;
    }
}
function renderContent(entry) {
    const nodes = [];
    const word = document.createElement('div');
    word.className = 'avs-card-word';
    word.textContent = entry.word;
    nodes.push(word);
    nodes.push(row('Meaning', entry.meaning || 'No explanation yet — open the popup to ask your AI.'));
    if (entry.note)
        nodes.push(row('Note', entry.note));
    nodes.push(row('Saved', formatSavedDate(entry.createdAt)));
    return nodes;
}
function row(label, value) {
    const wrapper = document.createElement('div');
    wrapper.className = 'avs-card-row';
    const labelEl = document.createElement('div');
    labelEl.className = 'avs-card-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.textContent = value;
    wrapper.append(labelEl, valueEl);
    return wrapper;
}
