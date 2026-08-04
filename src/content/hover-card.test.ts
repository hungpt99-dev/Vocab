import { beforeEach, describe, expect, it } from 'vitest';
import { CARD_ACTION_EVENT, computePosition, formatSavedDate, HoverCard } from './hover-card';
import type { HighlightEntry } from './matcher';

const entry: HighlightEntry = {
  id: 'a1',
  word: 'serendipity',
  wordKey: 'serendipity',
  note: 'from an article',
  createdAt: Date.UTC(2026, 0, 15),
  meaning: 'A fortunate accident.',
  pronunciation: '',
  explanation: null,
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('formatSavedDate', () => {
  it('renders a human date', () => {
    expect(formatSavedDate(entry.createdAt)).toMatch(/2026/);
  });
});

describe('computePosition', () => {
  const card = { width: 300, height: 100 };
  const viewport = { width: 1000, height: 800 };

  it('places the card below the anchor when it fits', () => {
    const { top } = computePosition({ top: 100, bottom: 120, left: 50 }, card, viewport);
    expect(top).toBe(130);
  });

  it('flips above the anchor near the bottom edge', () => {
    const { top } = computePosition({ top: 700, bottom: 760, left: 50 }, card, viewport);
    expect(top).toBe(590);
  });

  it('clamps to the right edge', () => {
    const { left } = computePosition({ top: 10, bottom: 30, left: 980 }, card, viewport);
    expect(left).toBe(690);
  });

  it('clamps to the left edge', () => {
    const { left } = computePosition({ top: 10, bottom: 30, left: -50 }, card, viewport);
    expect(left).toBe(10);
  });
});

describe('HoverCard', () => {
  it('shows meaning, note and date, and links the anchor via aria', () => {
    document.body.innerHTML = '<mark id="m">serendipity</mark>';
    const anchor = document.getElementById('m') as HTMLElement;

    const card = new HoverCard();
    card.show(anchor, entry);

    const element = document.getElementById('avs-hover-card')!;
    expect(element.hidden).toBe(false);
    expect(element.getAttribute('role')).toBe('tooltip');
    expect(element.textContent).toContain('A fortunate accident.');
    expect(element.textContent).toContain('from an article');
    expect(anchor.getAttribute('aria-describedby')).toBe('avs-hover-card');
  });

  it('falls back when there is no explanation yet', () => {
    document.body.innerHTML = '<mark id="m">x</mark>';
    new HoverCard().show(document.getElementById('m') as HTMLElement, { ...entry, meaning: '', note: '' });
    expect(document.getElementById('avs-hover-card')!.textContent).toContain('No explanation yet');
  });

  it('hides the original word when requested', () => {
    document.body.innerHTML = '<mark id="m">x</mark>';
    const card = new HoverCard();
    card.show(document.getElementById('m') as HTMLElement, entry, { showOriginal: false, showTranslation: true });

    const element = document.getElementById('avs-hover-card')!;
    expect(element.textContent).not.toContain(entry.word);
    expect(element.textContent).toContain('A fortunate accident.');
  });

  it('hides the translation when requested', () => {
    document.body.innerHTML = '<mark id="m">x</mark>';
    const card = new HoverCard();
    card.show(document.getElementById('m') as HTMLElement, entry, { showOriginal: true, showTranslation: false });

    const element = document.getElementById('avs-hover-card')!;
    expect(element.textContent).toContain(entry.word);
    expect(element.textContent).not.toContain('A fortunate accident.');
  });

  it('keeps note and date when both sections are hidden', () => {
    document.body.innerHTML = '<mark id="m">x</mark>';
    const card = new HoverCard();
    card.show(document.getElementById('m') as HTMLElement, entry, { showOriginal: false, showTranslation: false });

    const element = document.getElementById('avs-hover-card')!;
    expect(element.textContent).toContain('from an article');
    expect(element.textContent).toContain('Saved');
  });

  it('hides and clears the aria link', () => {
    document.body.innerHTML = '<mark id="m">x</mark>';
    const anchor = document.getElementById('m') as HTMLElement;
    const card = new HoverCard();

    card.show(anchor, entry);
    card.hide(anchor);

    expect(document.getElementById('avs-hover-card')!.hidden).toBe(true);
    expect(anchor.hasAttribute('aria-describedby')).toBe(false);
  });

  it('reuses a single card element', () => {
    document.body.innerHTML = '<mark id="m">x</mark>';
    const anchor = document.getElementById('m') as HTMLElement;
    const card = new HoverCard();

    card.show(anchor, entry);
    card.show(anchor, entry);
    expect(document.querySelectorAll('.avs-card')).toHaveLength(1);

    card.destroy();
    expect(document.querySelectorAll('.avs-card')).toHaveLength(0);
  });

  it('shows the pronunciation row when one is available', () => {
    document.body.innerHTML = '<mark id="m">serendipity</mark>';
    const anchor = document.getElementById('m') as HTMLElement;
    const card = new HoverCard();

    card.show(anchor, { ...entry, pronunciation: '/ˌser.ənˈdɪp.ə.ti/' });

    const element = document.getElementById('avs-hover-card')!;
    expect(element.textContent).toContain('/ˌser.ənˈdɪp.ə.ti/');
    expect(element.textContent).toContain('Pronunciation');

    card.destroy();
  });

  it('omits the pronunciation row when there is none', () => {
    document.body.innerHTML = '<mark id="m">serendipity</mark>';
    new HoverCard().show(document.getElementById('m') as HTMLElement, entry);
    expect(document.getElementById('avs-hover-card')!.textContent).not.toContain('Pronunciation');
  });

  it('renders an AI-explain shortcut that dispatches the card action', () => {
    document.body.innerHTML = '<mark id="m">serendipity</mark>';
    const anchor = document.getElementById('m') as HTMLElement;
    const card = new HoverCard();
    card.show(anchor, entry);

    const button = document.querySelector<HTMLButtonElement>('.avs-card-explain')!;
    expect(button).not.toBeNull();
    expect(button.textContent).toBe('AI explain');

    const dispatched: HighlightEntry[] = [];
    document.addEventListener(CARD_ACTION_EVENT, (event) => {
      dispatched.push((event as CustomEvent<{ entry: HighlightEntry }>).detail.entry);
    });
    button.click();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]?.word).toBe('serendipity');

    card.destroy();
  });

  it('reflects the loading state while an explanation is requested', () => {
    document.body.innerHTML = '<mark id="m">serendipity</mark>';
    const anchor = document.getElementById('m') as HTMLElement;
    const card = new HoverCard();
    card.show(anchor, entry);

    card.setExplaining(true);
    const button = document.querySelector<HTMLButtonElement>('.avs-card-explain')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Explaining…');

    card.setExplaining(false);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('AI explain');

    card.destroy();
  });

  it('re-renders in place with fresh information and stays open', () => {
    document.body.innerHTML = '<mark id="m">serendipity</mark>';
    const anchor = document.getElementById('m') as HTMLElement;
    const card = new HoverCard();
    card.show(anchor, entry);

    const updated = { ...entry, meaning: 'A new meaning.', pronunciation: '/njuː/' };
    card.update(updated);

    const element = document.getElementById('avs-hover-card')!;
    expect(element.hidden).toBe(false);
    expect(element.textContent).toContain('A new meaning.');
    expect(element.textContent).toContain('/njuː/');

    card.destroy();
  });

  it('reports whether a node lives inside the card', () => {
    document.body.innerHTML = '<mark id="m">serendipity</mark>';
    const anchor = document.getElementById('m') as HTMLElement;
    const card = new HoverCard();
    card.show(anchor, entry);

    const button = document.querySelector('.avs-card-explain')!;
    expect(card.contains(button)).toBe(true);
    expect(card.contains(document.body)).toBe(false);

    card.destroy();
  });
});
