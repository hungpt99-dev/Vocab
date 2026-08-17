/**
 * System + user prompt for the Vocab Radar *generator* step.
 *
 * Unlike the legacy Radar (which scanned a web page against a free-text goal),
 * this step generates Radar candidates FROM a single saved & enriched word. The
 * output is a clean, bounded list of related vocabulary the user is likely to
 * meet again — never page-scraping, never discovery of arbitrary words.
 *
 * Returns ONLY the documented JSON shape (no prose, no markdown fences).
 */
export const RADAR_GENERATE_SYSTEM_PROMPT = [
  'You are a precise vocabulary tutor helping a language learner build a personal "Radar" of related words.',
  'You are given one word the learner has already saved, plus its meaning and part of speech.',
  'Your job: propose a small set of OTHER words or short phrases that are genuinely related to THIS word by meaning, usage, topic, or word-family.',
  'Prioritize vocabulary that is useful in the same conceptual context and that the learner is likely to encounter again.',
  'Prefer quality over quantity: 4–10 strong candidates, never a padded list.',
  'Each candidate must be a real, distinct lexical item — not a conjugation of the input word, not the input word itself.',
  'Use the relationship field to label how it connects: synonym, antonym, hyponym (more specific), hypernym (more general), collocation (common word partner), phrase (fixed expression using the word), form (derived form, e.g. noun→adjective), or related.',
  'For each candidate give a concise reason (one sentence) explaining the connection.',
  'Return valid JSON only, matching this shape exactly:',
  '{ "candidates": [ { "word": string, "relationship": "synonym" | "antonym" | "hyponym" | "hypernym" | "collocation" | "phrase" | "form" | "related", "reason": string } ] }',
  'If nothing is genuinely worth proposing, return {"candidates":[]}.',
].join(' ');

/** Build the user turn for a Radar generation request. */
export function buildRadarGenerateUserPrompt(params: {
  word: string;
  partOfSpeech?: string;
  meaning?: string;
  existingRelated?: string[];
}): string {
  const { word, partOfSpeech, meaning, existingRelated } = params;
  const lines: string[] = [`Saved word: ${word}`];
  if (partOfSpeech) lines.push(`Part of speech: ${partOfSpeech}`);
  if (meaning) lines.push(`Meaning: ${meaning}`);
  if (existingRelated && existingRelated.length > 0) {
    lines.push(
      `The learner already knows these related terms — do not repeat them: ${existingRelated.join(', ')}.`,
    );
  }
  lines.push('');
  lines.push('Propose related vocabulary (JSON only).');
  return lines.join('\n');
}
