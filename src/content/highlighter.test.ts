import { describe, expect, it } from 'vitest';
import {
  buildRadarMatcher,
  highlightRadarRoot,
  RADAR_HIGHLIGHT_CLASS,
  removeRadarHighlights,
} from './highlighter';
import type { RadarMatchEntry } from './highlighter';

function makeEntry(word: string): RadarMatchEntry {
  return { key: word.toLowerCase(), text: word, tier: 'high' };
}

function radarHighlights(html: string, entries: RadarMatchEntry[]): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  highlightRadarRoot(container, entries);
  return container.innerHTML;
}

describe('buildRadarMatcher', () => {
  it('returns null for no entries', () => {
    expect(buildRadarMatcher([])).toBeNull();
  });

  it('matches a single word case-insensitively with word boundaries', () => {
    const re = buildRadarMatcher([makeEntry('contribution')]);
    expect(re).not.toBeNull();
    expect('contribution'.match(re!)).toBeTruthy();
    expect('Contribution'.match(re!)).toBeTruthy();
    // Not part of a larger word.
    expect('anticontribution'.match(re!)).toBeNull();
  });
});

describe('highlightRadarRoot', () => {
  it('wraps a generated Radar candidate in a radar-highlight mark', () => {
    const out = radarHighlights('The contribution was important.', [makeEntry('contribution')]);
    expect(out).toContain(RADAR_HIGHLIGHT_CLASS);
    expect(out).toContain('>contribution<');
  });

  it('matches the candidate even when it is NOT a saved word', () => {
    // Radar highlighting must not depend on saved-word highlighting at all.
    const out = radarHighlights(
      'We value your contribution to the project.',
      [makeEntry('contribution')],
    );
    expect(out).toContain(RADAR_HIGHLIGHT_CLASS);
  });

  it('highlights multiple distinct candidates independently', () => {
    const out = radarHighlights('contribute and contribution matter.', [
      makeEntry('contribute'),
      makeEntry('contribution'),
    ]);
    const marks = out.match(new RegExp(RADAR_HIGHLIGHT_CLASS, 'g')) ?? [];
    expect(marks.length).toBe(2);
  });

  it('removeRadarHighlights restores plain text', () => {
    const container = document.createElement('div');
    container.innerHTML = 'Your contribution is noted.';
    highlightRadarRoot(container, [makeEntry('contribution')]);
    expect(container.innerHTML).toContain(RADAR_HIGHLIGHT_CLASS);
    removeRadarHighlights(container);
    expect(container.innerHTML).not.toContain(RADAR_HIGHLIGHT_CLASS);
    expect(container.textContent).toBe('Your contribution is noted.');
  });
});
