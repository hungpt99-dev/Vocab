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

export interface BackgroundDeps {
  vocabulary: VocabularyRepository;
  settings: SettingsRepository;
  explain: ExplainService;
  translate: TranslateService;
}

export const defaultDeps: BackgroundDeps = {
  vocabulary: defaultVocabularyRepository,
  settings: defaultSettingsRepository,
  explain: defaultExplainService,
  translate: defaultTranslationService,
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
    sourceLanguage: selection.sourceLanguage,
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
    bilingualMode: settings.bilingualMode,
    targetLanguage: settings.targetLanguage,
    readingExperience: settings.readingExperience,
    entries: entries.map((entry) => ({
      id: entry.id,
      word: entry.word,
      wordKey: entry.wordKey,
      note: entry.note,
      createdAt: entry.createdAt,
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
): Promise<Explanation> {
  const settings = await deps.settings.get();
  const explanation = await deps.explain.explain({
    word,
    context,
    kind,
    pageTitle,
    precedingText,
    language: settings.targetLanguage || 'English',
    promptTemplate: settings.explainPromptTemplate,
  });
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
  const settings = await deps.settings.get();
  const explanation = await deps.explain.explain({
    word: input.word,
    context: input.context,
    kind: 'vocabulary',
    language: settings.targetLanguage || 'English',
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

/** Translate a single page unit (paragraph, heading, list item…) via the AI layer. */
export async function translateUnit(
  deps: BackgroundDeps,
  payload: { text: string; language?: string },
): Promise<string> {
  const results = await deps.translate.translate(
    [{ id: 'unit', text: payload.text }],
    payload.language ?? 'English',
  );
  return results[0]?.translation ?? '';
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
    translate: (message) => translateUnit(deps, message.payload),
    'translate-blocks': async (message) => {
      const settings = await deps.settings.get();
      const language = settings.targetLanguage || 'English';
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
    'open-options': () => {
      void chrome.runtime.openOptionsPage();
    },
    'vocabulary-changed': () => undefined,
    'settings-changed': () => undefined,
  };
}
