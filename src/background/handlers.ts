import type { ExplainKind } from '@/shared/types/ai';
import type { Explanation, VocabularyEntry } from '@/shared/types/vocabulary';
import type { DifficultWordsPayload, HighlightData, SelectionPayload } from '@/shared/messaging/contract';
import type { HandlerMap } from '@/shared/messaging/router';
import { broadcast, sendToTab } from '@/shared/messaging/client';
import { ExplainService, explainService as defaultExplainService } from '@/ai/explain-service';
import {
  TranslateService,
  translateService as defaultTranslationService,
} from '@/ai/translate-service';
import {
  SettingsRepository,
  settingsRepository as defaultSettingsRepository,
} from '@/storage/settings-repository';
import {
  VocabularyRepository,
  vocabularyRepository as defaultVocabularyRepository,
} from '@/storage/vocabulary-repository';
import { ReviewRepository, reviewRepository as defaultReviewRepository } from '@/storage/review-repository';
import { generateRadarForWord, removeRadarWord, dropRadarSource, backfillRadar } from '@/features/radar/radar-background';
import { radarStore } from '@/features/radar/radar-store';
import { settleEnrichSession } from '@/features/capture/enrich-session';

export interface BackgroundDeps {
  vocabulary: VocabularyRepository;
  settings: SettingsRepository;
  explain: ExplainService;
  translate: TranslateService;
  review: ReviewRepository;
}

export const defaultDeps: BackgroundDeps = {
  vocabulary: defaultVocabularyRepository,
  settings: defaultSettingsRepository,
  explain: defaultExplainService,
  translate: defaultTranslationService,
  review: defaultReviewRepository,
};

/** Read the current selection from the active tab, if any. */
export async function readActiveSelection(): Promise<SelectionPayload | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  return sendToTab(tab.id, { type: 'get-selection' });
}

/** Persist a selection and notify every surface that data changed. */
export async function saveSelection(
  deps: BackgroundDeps,
  selection: SelectionPayload,
): Promise<VocabularyEntry> {
  const saved = await deps.vocabulary.save({
    word: selection.word,
    sentence: selection.sentence,
    sourceUrl: selection.sourceUrl,
    sourceTitle: selection.sourceTitle,
    sourceLanguage: selection.sourceLanguage,
  });
  // Schedule the new word for spaced-repetition review (best-effort, never blocks save).
  await deps.review.ensureScheduled(saved).catch(() => undefined);

  const settings = await deps.settings.get();
  if (settings.autoExplainOnSave && !saved.explanation) {
    try {
      const explanation = await deps.explain.explainWith(settings, {
        word: saved.word,
        context: saved.sentence,
        pageTitle: selection.sourceTitle,
        precedingText: selection.precedingText,
      });
      const enriched = await deps.vocabulary.update(saved.id, { explanation });
      // Generating Radar candidates from the freshly enriched word is best-effort
      // and must not block or fail the save.
      void generateRadarForWord(enriched);
      return enriched;
    } catch {
      // Auto-explain is best-effort; the entry is already safely stored.
    }
  }
  return saved;
}

export async function buildHighlightData(deps: BackgroundDeps): Promise<HighlightData> {
  const [settings, entries] = await Promise.all([
    deps.settings.get(),
    deps.vocabulary.list({ sortBy: 'word', sortDirection: 'asc' }),
  ]);

  return {
    enabled: settings.highlightEnabled,
    color: settings.highlightColor,
    readingMode: settings.readingMode,
    allowedDomains: settings.allowedDomains,
    targetLanguage: settings.targetLanguage?.name || 'English',
    readingExperience: settings.readingExperience,
    radar:
      settings.radar?.enabled !== false
        ? (await radarStore.listViews()).map((r) => ({
            word: r.word,
            wordKey: r.wordKey,
            relationship: r.relationship,
            reason: r.reason,
            sourceWords: r.sourceWords,
          }))
        : [],
    entries: entries.map((entry) => ({
      id: entry.id,
      word: entry.word,
      wordKey: entry.wordKey,
      note: entry.note,
      createdAt: entry.createdAt,
      sourceLanguage: entry.sourceLanguage,
      meaning: entry.explanation?.meaning ?? '',
      pronunciation: entry.explanation?.pronunciation ?? '',
      explanation: entry.explanation ?? null,
    })),
  };
}

export async function explainWord(
  deps: BackgroundDeps,
  word: string,
  context?: string,
  kind?: ExplainKind,
  pageTitle?: string,
  precedingText?: string,
  language?: string,
): Promise<Explanation> {
  const settings = await deps.settings.get();
  const explanation = await deps.explain.explain({
    word,
    context,
    kind,
    pageTitle,
    precedingText,
    language: language ?? (settings.targetLanguage?.name || 'English'),
    promptTemplate: settings.explainPromptTemplate,
  });

  // The explain prompt asks the model for a target-language `translation`, but
  // models frequently return it empty. Fall back to the keyless Google
  // translator (same path as bilingual reading, VOC-101) so the card's
  // "Translation" row is never silently missing when the user wants one.
  const target = settings.targetLanguage?.name || 'English';
  if (!explanation.translation && target.toLowerCase() !== 'english') {
    try {
      const [result] = await deps.translate.translate([{ id: 'w', text: word }], target);
      explanation.translation = result?.translation ?? '';
    } catch {
      // Translation is best-effort; leave it empty if the network call fails.
    }
  }

  const existing = await deps.vocabulary.findByWord(word);
  if (existing) {
    const updated = await deps.vocabulary.update(existing.id, { explanation });
    await broadcast({ type: 'vocabulary-changed' });
    // Re-generate Radar candidates from the now-enriched saved word.
    void generateRadarForWord(updated);
  }
  return explanation;
}

/** Split a "term: brief meaning" item into its word and meaning halves. */
export function splitVocabularyTerm(item: string): { word: string; meaning: string } {
  const [word = '', ...rest] = item.split(/\s*[—–:]\s*/u);
  return { word: word.trim(), meaning: rest.join(': ').trim() };
}

/**
 * Extract the difficult words from a selection via the AI, then persist each
 * as a vocabulary entry. Returns the entries that were saved (new or merged).
 */
export async function saveDifficultWords(
  deps: BackgroundDeps,
  input: DifficultWordsPayload,
): Promise<VocabularyEntry[]> {
  const settings = await deps.settings.get();
  const explanation = await deps.explain.explain({
    word: input.word,
    context: input.context,
    kind: 'vocabulary',
    language: settings.targetLanguage?.name || 'English',
    promptTemplate: settings.explainPromptTemplate,
  });

  const entries: VocabularyEntry[] = [];
  for (const raw of explanation.relatedWords) {
    const { word, meaning } = splitVocabularyTerm(raw);
    if (!word.trim()) continue;
    entries.push(
      await deps.vocabulary.save({
        word,
        sentence: input.context,
        sourceUrl: input.sourceUrl,
        sourceTitle: input.sourceTitle,
        note: meaning,
      }),
    );
  }

  if (entries.length > 0) {
    await broadcast({ type: 'vocabulary-changed' });
  }
  return entries;
}

/**
 * Whether the tab that sent a message is the currently active tab in its
 * window. Used to ensure bilingual (inline) translation runs in exactly one
 * tab — the one the user is looking at — rather than every open tab.
 */
export async function isActiveTab(senderTabId: number | undefined): Promise<boolean> {
  if (typeof senderTabId !== 'number') return false;
  try {
    // Check whether the sender's OWN tab is the active tab within its window.
    // We intentionally do NOT use `chrome.tabs.query({ active: true, currentWindow: true })`:
    // from a service worker `currentWindow` is meaningless, so that query returns the
    // wrong tab and bilingual silently fails to open ("nothing happens"). Asking for the
    // sender tab directly is also immune to the popup stealing focus when the user toggles
    // bilingual from the toolbar popup — the page tab remains `active` in its own window.
    const tab = await chrome.tabs.get(senderTabId);
    return tab?.active === true;
  } catch {
    return false;
  }
}

/** Translate a single page unit (paragraph, heading, list item…) via the AI layer. */
export async function translateUnit(
  deps: BackgroundDeps,
  payload: { text: string; language?: string },
): Promise<string> {
  // No explicit language means "translate into the user's configured target
  // language" — otherwise we'd silently translate English→English and return the
  // source unchanged (which the UI renders as a blank "—"). See VOC-119.
  let language = payload.language;
  if (!language) {
    try {
      const settings = await deps.settings.get();
      language = settings.targetLanguage?.name || 'English';
    } catch {
      language = 'English';
    }
  }
  const results = await deps.translate.translate([{ id: 'unit', text: payload.text }], language);
  return results[0]?.translation ?? '';
}

/** Delete a saved vocabulary entry and drop it as a Radar source. */
export async function deleteVocabulary(
  deps: BackgroundDeps,
  id: string,
): Promise<void> {
  await deps.vocabulary.remove(id);
  await dropRadarSource(id);
  await broadcast({ type: 'vocabulary-changed' });
}
/** Build the handler map used by the service worker's message router. */
export function createHandlers(deps: BackgroundDeps = defaultDeps): HandlerMap {
  return {
    'save-entry': async (message) => {
      const entry = await deps.vocabulary.save(message.payload);
      await broadcast({ type: 'vocabulary-changed' });
      return entry;
    },
    'get-selection': () => readActiveSelection(),
    'save-current-selection': async () => {
      const selection = await readActiveSelection();
      if (!selection?.word.trim()) return null;
      const entry = await saveSelection(deps, selection);
      await broadcast({ type: 'vocabulary-changed' });
      return entry;
    },
    'save-selection': async (message) => {
      const entry = await saveSelection(deps, message.payload);
      await broadcast({ type: 'vocabulary-changed' });
      return entry;
    },
    'get-highlight-data': () => buildHighlightData(deps),
    explain: async (message) => {
      let explanation: Explanation;
      try {
        explanation = await explainWord(
          deps,
          message.payload.word,
          message.payload.context,
          message.payload.kind,
          message.payload.pageTitle,
          message.payload.precedingText,
          message.payload.language,
        );
        // AI explain doubles as Radar generation: any word the user enriches that
        // is already saved gets Radar candidates produced automatically (no
        // separate button). Best-effort; a failed AI call must not break explain.
        const saved = await deps.vocabulary.findByWord(message.payload.word);
        if (saved) void generateRadarForWord(saved);
      } catch (error) {
        // Settle any durable enrich session for this word: the popup may have
        // closed mid-call and reopened, and must never resume a stuck spinner.
        void settleEnrichSession(message.payload.word, null);
        throw error;
      }
      // The worker always runs to completion, so it — not the popup — settles
      // the enrich session. A popup that reopened mid-call picks up the result.
      void settleEnrichSession(message.payload.word, explanation);
      return explanation;
    },
    'save-difficult-words': (message) => saveDifficultWords(deps, message.payload),
    translate: (message) => translateUnit(deps, message.payload),
    'translate-blocks': async (message) => {
      const settings = await deps.settings.get();
      const language = settings.targetLanguage?.name || 'English';
      const paragraphs = message.payload.blocks.map((text, index) => ({ id: String(index), text }));
      const results = await deps.translate.translate(paragraphs, language);
      const byId = new Map(results.map((result) => [result.id, result.translation]));
      return paragraphs.map((paragraph) => byId.get(paragraph.id) ?? null);
    },
    'translate-article': async (message) => {
      const results = await deps.translate.translate(message.payload.paragraphs, message.payload.language);
      return results.map((result) => ({
        id: result.id,
        text: result.text,
        translation: result.translation,
      }));
    },
    'align-words': async (message) => {
      const results = await deps.translate.alignWords(message.payload.paragraphs, message.payload.language);
      return results.map((result) => ({
        id: result.id,
        text: result.text,
        pairs: result.pairs,
        translation: result.translation,
      }));
    },
    'open-options': () => {
      void chrome.runtime.openOptionsPage();
    },
    'am-i-active-tab': (_message, sender) => isActiveTab(sender.tab?.id),
    'bilingual:reconcile': () => undefined,
    'vocabulary-changed': () => undefined,
    'settings-changed': () => undefined,
    'delete-entry': async (message) => {
      await deleteVocabulary(deps, message.payload.id);
    },
    'radar:save': async (message) => {
      // Move a Radar candidate into Saved Vocabulary, then remove it from Radar.
      const { word, sentence, sourceUrl, sourceTitle, sourceLanguage } = message.payload;
      const entry = await deps.vocabulary.save({
        word,
        sentence,
        sourceUrl,
        sourceTitle,
        sourceLanguage,
      });
      await removeRadarWord(message.payload.wordKey);
      await broadcast({ type: 'vocabulary-changed' });
      return entry;
    },
    'radar:generate': async (message) => {
      const entry = await deps.vocabulary.get(message.payload.id);
      if (!entry) return;
      // Ensure the word is enriched so generation has meaning/part-of-speech to work with.
      if (!entry.explanation) {
        await explainWord(deps, entry.word, entry.sentence, 'word', entry.sourceTitle);
      }
      const updated = (await deps.vocabulary.findByWord(entry.word)) ?? entry;
      await generateRadarForWord(updated);
    },
    'radar:generate-all': async () => {
      const saved = await deps.vocabulary.list({ sortBy: 'word', sortDirection: 'asc' });
      for (const entry of saved) {
        if (!entry.explanation) continue;
        const has = await radarStore.findByWordKey(entry.wordKey);
        if (has) continue;
        // Explicit user action: use the AI path (with local fallback) so each
        // word gets distinct discovery candidates, not just its own terms.
        await generateRadarForWord(entry);
      }
    },
    'radar:backfill': async () => {
      await backfillRadar(deps.vocabulary);
    },
    'radar:remove': async (message) => {
      await radarStore.removeByWordKey(message.payload.wordKey);
      await broadcast({ type: 'radar-changed' });
    },
    'radar:list': async () => radarStore.listViews(),
  };
}
