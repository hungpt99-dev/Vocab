import { describe, expect, it } from 'vitest';
import {
  cardOwnsInteraction,
  isInsideCard,
  shouldHideOnSelectionChange,
} from './selection-dismiss';

describe('selection card dismissal (VOC-123)', () => {
  it('keeps the card open when a click inside it collapses the selection', () => {
    // The exact bug: clicking a card control empties the selection.
    expect(shouldHideOnSelectionChange({ selectionEmpty: true, interactingWithCard: true })).toBe(
      false,
    );
  });

  it('still dismisses the card when the selection is cleared outside it', () => {
    expect(shouldHideOnSelectionChange({ selectionEmpty: true, interactingWithCard: false })).toBe(
      true,
    );
  });

  it('never dismisses while a real selection exists', () => {
    for (const interactingWithCard of [true, false]) {
      expect(shouldHideOnSelectionChange({ selectionEmpty: false, interactingWithCard })).toBe(
        false,
      );
    }
  });
});

describe('isInsideCard', () => {
  it('recognises the card itself and its descendants', () => {
    const card = document.createElement('div');
    const button = document.createElement('button');
    const label = document.createTextNode('X-Ray');
    button.append(label);
    card.append(button);

    expect(isInsideCard(card, card)).toBe(true);
    expect(isInsideCard(button, card)).toBe(true);
    // Deeply nested nodes count too — e.g. text inside a <summary>.
    expect(isInsideCard(label, card)).toBe(true);
  });

  it('rejects outside nodes and missing arguments', () => {
    const card = document.createElement('div');
    expect(isInsideCard(document.createElement('p'), card)).toBe(false);
    expect(isInsideCard(null, card)).toBe(false);
    expect(isInsideCard(card, null)).toBe(false);
  });
});

describe('cardOwnsInteraction', () => {
  it('is true while the pointer is down inside the card', () => {
    const card = document.createElement('div');
    expect(cardOwnsInteraction(card, document.body, true)).toBe(true);
  });

  it('is true when focus lives inside the card', () => {
    const card = document.createElement('div');
    const summary = document.createElement('summary');
    card.append(summary);
    expect(cardOwnsInteraction(card, summary, false)).toBe(true);
  });

  it('is false when the card is absent or the interaction is elsewhere', () => {
    const card = document.createElement('div');
    expect(cardOwnsInteraction(null, card, true)).toBe(false);
    expect(cardOwnsInteraction(card, document.body, false)).toBe(false);
  });
});
