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
 */
export async function generateRadarForWord(entry: VocabularyEntry): Promise<number> {
  const settings = await settingsRepository.get();
  if (!settings.radar?.enabled) return 0;

  const explanation = entry.explanation;
  const seedFromExplanation = (): RadarCandidateInput[] => {
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
      out.push({ word, relationship: 'related', reason: `From “${entry.word}” explanation` });
    }
    return out;
  };

  let candidates: RadarCandidateInput[] = [];
  try {
    const result = await radarGeneratorService.generate(settings, {
      word: entry.word,
      partOfSpeech: explanation?.partOfSpeech ?? entry.partOfSpeech,
      meaning: explanation?.meaning,
      existingRelated: seedFromExplanation().map((c) => c.word),
    });
    candidates = result.candidates ?? [];
  } catch (error) {
    console.warn(`[radar] AI generation failed for "${entry.word}" — falling back to explanation terms:`, error);
  }

  if (candidates.length === 0) {
    candidates = seedFromExplanation();
  }

  if (candidates.length > 0) {
    await radarStore.addCandidates(entry, candidates);
    await broadcastRadarChanged();
  } else {
    console.warn(`[radar] no candidates for "${entry.word}" (no AI output and no explanation terms)`);
  }
  return candidates.length;
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
