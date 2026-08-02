import type { ExplainKind } from '@/shared/types/ai';
import type { Explanation, VocabularyEntry } from '@/shared/types/vocabulary';
import type { DifficultWordsPayload, HighlightData, SelectionPayload } from '@/shared/messaging/contract';
import type { HandlerMap } from '@/shared/messaging/router';
import { broadcast, sendToTab } from '@/shared/messaging/client';
import { ExplainService, explainService as defaultExplainService } from '@/ai/explain-service';
import {
  SettingsRepository,
  settingsRepository as defaultSettingsRepository,
} from '@/storage/settings-repository';
import {
  VocabularyRepository,
  vocabularyRepository as defaultVocabularyRepository,
} from '@/storage/vocabulary-repository';

export interface BackgroundDeps {
  vocabulary: VocabularyRepository;
  settings: SettingsRepository;
  explain: ExplainService;
}

export const defaultDeps: BackgroundDeps = {
  vocabulary: defaultVocabularyRepository,
  settings: defaultSettingsRepository,
  explain: defaultExplainService,
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
  const entry = await deps.vocabulary.save({
    word: selection.word,
    sentence: selection.sentence,
    sourceUrl: selection.sourceUrl,
    sourceTitle: selection.sourceTitle,
  });

  const settings = await deps.settings.get();
  if (settings.autoExplainOnSave && !entry.explanation) {
    try {
      const explanation = await deps.explain.explainWith(settings, {
        word: entry.word,
        context: entry.sentence,
        pageTitle: selection.sourceTitle,
        precedingText: selection.precedingText,
      });
      return await deps.vocabulary.update(entry.id, { explanation });
    } catch {
      // Auto-explain is best-effort; the entry is already safely stored.
    }
  }
  return entry;
}

export async function buildHighlightData(deps: BackgroundDeps): Promise<HighlightData> {
  const [settings, entries] = await Promise.all([
    deps.settings.get(),
    deps.vocabulary.list({ sortBy: 'word', sortDirection: 'asc' }),
  ]);

  return {
    enabled: settings.highlightEnabled,
    color: settings.highlightColor,
    readingExperience: settings.readingExperience,
    entries: entries.map((entry) => ({
      id: entry.id,
      word: entry.word,
      wordKey: entry.wordKey,
      note: entry.note,
      createdAt: entry.createdAt,
      meaning: entry.explanation?.meaning ?? '',
      pronunciation: entry.explanation?.pronunciation ?? '',
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
): Promise<Explanation> {
  const explanation = await deps.explain.explain({ word, context, kind, pageTitle, precedingText });
  const existing = await deps.vocabulary.findByWord(word);
  if (existing) {
    await deps.vocabulary.update(existing.id, { explanation });
    await broadcast({ type: 'vocabulary-changed' });
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
  const explanation = await deps.explain.explain({
    word: input.word,
    context: input.context,
    kind: 'vocabulary',
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

/** Build the handler map used by the service worker's message router. */
export function createHandlers(deps: BackgroundDeps = defaultDeps): HandlerMap {
  return {
    'save-entry': async (message) => {
      const entry = await deps.vocabulary.save(message.payload);
      await broadcast({ type: 'vocabulary-changed' });
      return entry;
    },
    'save-current-selection': async () => {
      const selection = await readActiveSelection();
      if (!selection?.word.trim()) return null;
      const entry = await saveSelection(deps, selection);
      await broadcast({ type: 'vocabulary-changed' });
      return entry;
    },
    'get-highlight-data': () => buildHighlightData(deps),
    explain: (message) =>
      explainWord(
        deps,
        message.payload.word,
        message.payload.context,
        message.payload.kind,
        message.payload.pageTitle,
        message.payload.precedingText,
      ),
    'save-difficult-words': (message) => saveDifficultWords(deps, message.payload),
    'vocabulary-changed': () => undefined,
    'settings-changed': () => undefined,
  };
}
