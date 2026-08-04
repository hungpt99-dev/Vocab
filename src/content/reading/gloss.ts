import type { WordAlignResult, WordPair } from '@/ai/types';

/**
 * Build an interlinear (word-by-word) gloss element for a block. Each source
 * token is shown with its target-language gloss beneath it. When the model did
 * not return a usable alignment we fall back to a single sentence-level
 * translation line so the feature degrades gracefully.
 */
export function buildGlossBlock(result: WordAlignResult): HTMLElement {
  const container = document.createElement('div');
  container.className = 'avs-gloss-block';

  if (result.pairs.length === 0) {
    container.append(buildSentenceBlock(result.translation));
    return container;
  }

  const row = document.createElement('div');
  row.className = 'avs-gloss-row';
  for (const pair of result.pairs) {
    row.append(buildWordGloss(pair));
  }
  container.append(row);

  if (result.translation && result.translation !== pairsToText(result.pairs)) {
    container.append(buildSentenceBlock(result.translation));
  }
  return container;
}

/** A compact sentence-level translation line (the no-alignment fallback). */
export function buildSentenceBlock(translation: string): HTMLElement {
  const line = document.createElement('div');
  line.className = 'avs-inline-translation';
  line.textContent = translation;
  return line;
}

function buildWordGloss(pair: WordPair): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'avs-gloss';

  const source = document.createElement('span');
  source.className = 'avs-gloss-source';
  source.textContent = pair.source;

  const target = document.createElement('span');
  target.className = 'avs-gloss-target';
  target.textContent = pair.target || '·';

  wrap.append(source, target);
  return wrap;
}

function pairsToText(pairs: WordPair[]): string {
  return pairs.map((pair) => pair.target).join(' ').trim();
}
