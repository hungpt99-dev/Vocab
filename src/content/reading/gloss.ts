/** A compact sentence-level translation line. */
export function buildSentenceBlock(translation: string): HTMLElement {
  const line = document.createElement('div');
  line.className = 'avs-inline-translation';
  line.textContent = translation;
  return line;
}

export function pairsToText(pairs: { source: string; target: string }[]): string {
  return pairs.map((pair) => pair.target).join(' ').trim();
}
