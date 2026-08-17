import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { settingsRepository } from '@/storage/settings-repository';
import { radarGeneratorService } from './radar-generator';
import { radarStore } from './radar-store';
import type { RadarCandidateInput } from './types';

/**
 * Background-side orchestration for Vocab Radar.
 *
 * Radar is generated FROM saved & enriched vocabulary. This module is the single
 * place that turns an enriched saved word into Radar candidates (and the inverse:
 * removing a word from Radar when it becomes Saved, or dropping its source when a
 * saved word is deleted). It owns no UI and no AI page-scanning.
 */

/**
 * Generate Radar candidates for a freshly saved + enriched word.
 *
 * Primary path: a dedicated AI call produces distinct discovery candidates.
 * Fallback: if that call fails or returns nothing, seed Radar from the word's
 * OWN explanation (relatedWords / synonyms / collocations / relatedPhrases) —
 * the "Related vocabulary" the user already sees. This guarantees Radar is
 * never silently empty after an explain, regardless of AI quirks.
 *
 * `opts.localOnly` skips the AI call and seeds straight from the saved
 * explanation — used by the backfill so re-deriving Radar for already-enriched
 * words costs no AI requests.
 */
export async function generateRadarForWord(
  entry: VocabularyEntry,
  opts: { localOnly?: boolean } = {},
): Promise<number> {
  const settings = await settingsRepository.get();
  // Enabled unless the user explicitly turned it off. Legacy settings that
  // predate the `radar.enabled` field must keep working (undefined => on).
  if (settings.radar?.enabled === false) return 0;

  const seedFromExplanation = (): RadarCandidateInput[] => candidatesFromExplanation(entry);

  let candidates: RadarCandidateInput[] = [];
  if (opts.localOnly) {
    // Backfill path: derive candidates from the word's already-saved explanation
    // (related words, synonyms, etc.) — no AI call, instant and free.
    candidates = seedFromExplanation();
  } else {
    try {
      const result = await radarGeneratorService.generate(settings, {
        word: entry.word,
        partOfSpeech: entry.explanation?.partOfSpeech ?? entry.partOfSpeech,
        meaning: entry.explanation?.meaning,
        existingRelated: seedFromExplanation().map((c) => c.word),
      });
      candidates = result.candidates ?? [];
    } catch (error) {
      console.warn(`[radar] AI generation failed for "${entry.word}" — falling back to explanation terms:`, error);
    }

    if (candidates.length === 0) {
      candidates = seedFromExplanation();
    }
  }

  if (candidates.length > 0) {
    await radarStore.addCandidates(entry, candidates);
    await broadcastRadarChanged();
  } else {
    console.warn(`[radar] no candidates for "${entry.word}" (no AI output and no explanation terms)`);
  }
  return candidates.length;
}

/**
 * Build Radar candidates from a saved word's existing explanation (related
 * words, synonyms, antonyms, collocations, related phrases). Local + free —
 * used as the fallback and as the backfill source so Radar reflects words the
 * user already enriched without a new AI call.
 */
export function candidatesFromExplanation(entry: VocabularyEntry): RadarCandidateInput[] {
  const explanation = entry.explanation;
  if (!explanation) return [];
  const seen = new Set<string>();
  const out: RadarCandidateInput[] = [];
  for (const raw of [
    ...(explanation.relatedWords ?? []),
    ...(explanation.synonyms ?? []),
    ...(explanation.antonyms ?? []),
    ...(explanation.collocations ?? []),
    ...(explanation.relatedPhrases ?? []),
  ]) {
    const word = raw.trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ word, relationship: 'related', reason: `From "${entry.word}" explanation` });
  }
  return out;
}

/**
 * On-demand backfill: generate Radar candidates for every enriched saved word
 * that isn't already in Radar. Uses the local explanation terms only (no AI),
 * so it's safe to run on startup or when the Radar tab opens. Idempotent.
 */
export async function backfillRadar(vocabulary: {
  list: (q: { sortBy: 'word'; sortDirection: 'asc' }) => Promise<VocabularyEntry[]>;
}): Promise<number> {
  const settings = await settingsRepository.get();
  if (settings.radar?.enabled === false) return 0;
  const saved = await vocabulary.list({ sortBy: 'word', sortDirection: 'asc' });
  let total = 0;
  for (const entry of saved) {
    if (!entry.explanation) continue;
    if (await radarStore.findByWordKey(entry.wordKey)) continue;
    total += await generateRadarForWord(entry, { localOnly: true });
  }
  return total;
}

/** Remove a word from Radar after it has been saved as official vocabulary. */
export async function removeRadarWord(wordKey: string): Promise<void> {
  await radarStore.removeByWordKey(wordKey);
  await broadcastRadarChanged();
}

/** Drop a saved word as a Radar source; delete Radar entries left with no sources. */
export async function dropRadarSource(sourceId: string): Promise<void> {
  await radarStore.dropSource(sourceId);
  await broadcastRadarChanged();
}

/** Reload the Radar list carried by highlight data without a full vocabulary reload. */
async function broadcastRadarChanged(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'radar-changed' });
  } catch {
    // No listeners yet (popup closed) — harmless.
  }
}
