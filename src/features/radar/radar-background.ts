import type { VocabularyEntry } from '@/shared/types/vocabulary';
import { settingsRepository } from '@/storage/settings-repository';
import { radarGeneratorService } from './radar-generator';
import { radarStore } from './radar-store';

/**
 * Background-side orchestration for Vocab Radar.
 *
 * Radar is generated FROM saved & enriched vocabulary. This module is the single
 * place that turns an enriched saved word into Radar candidates (and the inverse:
 * removing a word from Radar when it becomes Saved, or dropping its source when a
 * saved word is deleted). It owns no UI and no AI page-scanning.
 */

/** Generate Radar candidates for a freshly saved + enriched word. */
export async function generateRadarForWord(entry: VocabularyEntry): Promise<void> {
  const settings = await settingsRepository.get();
  if (!settings.radar?.enabled) return;

  const explanation = entry.explanation;
  const existingRelated = explanation
    ? [
        ...(explanation.relatedWords ?? []),
        ...(explanation.synonyms ?? []),
        ...(explanation.collocations ?? []),
        ...(explanation.relatedPhrases ?? []),
      ]
    : [];

  try {
    const { candidates } = await radarGeneratorService.generate(settings, {
      word: entry.word,
      partOfSpeech: explanation?.partOfSpeech ?? entry.partOfSpeech,
      meaning: explanation?.meaning,
      existingRelated: existingRelated.length ? existingRelated : undefined,
    });
    if (candidates.length > 0) {
      await radarStore.addCandidates(entry, candidates);
      await broadcastRadarChanged();
    }
  } catch {
    // Generation is best-effort: a failed AI call must not break the save.
  }
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
