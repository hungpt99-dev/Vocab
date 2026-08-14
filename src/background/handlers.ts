import type { ExplainKind } from '@/shared/types/ai';
import type { Explanation, VocabularyEntry } from '@/shared/types/vocabulary';
import type { DifficultWordsPayload, HighlightData, SelectionPayload } from '@/shared/messaging/contract';
import type { HandlerMap } from '@/shared/messaging/router';
import { broadcast, sendToTab } from '@/shared/messaging/client';
import { AiError } from '@/ai/types';
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
import { radarVocabularyService as defaultRadarService } from '@/features/radar/radar-service';

export interface BackgroundDeps {
  vocabulary: VocabularyRepository;
  settings: SettingsRepository;
  explain: ExplainService;
  translate: TranslateService;
  review: ReviewRepository;
  radarService: typeof defaultRadarService;
}

export const defaultDeps: BackgroundDeps = {
  vocabulary: defaultVocabularyRepository,
  settings: defaultSettingsRepository,
  explain: defaultExplainService,
  translate: defaultTranslationService,
  review: defaultReviewRepository,
  radarService: defaultRadarService,
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
      return await deps.vocabulary.update(saved.id, { explanation });
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
    bilingualMode: settings.bilingualMode,
    bilingualDomains: settings.bilingualDomains,
    targetLanguage: settings.targetLanguage,
    readingExperience: settings.readingExperience,
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
    language: language ?? (settings.targetLanguage || 'English'),
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

/**
 * Whether the tab that sent a message is the currently active tab in its
 * window. Used to ensure bilingual (inline) translation runs in exactly one
 * tab — the one the user is looking at — rather than every open tab.
 */
export async function isActiveTab(senderTabId: number | undefined): Promise<boolean> {
  if (typeof senderTabId !== 'number') return false;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id === senderTabId;
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
      language = settings.targetLanguage || 'English';
    } catch {
      language = 'English';
    }
  }
  const results = await deps.translate.translate([{ id: 'unit', text: payload.text }], language);
  return results[0]?.translation ?? '';
}

/**
 * Vocabulary Radar: analyse the active page against the user's Radar goal and
 * return ranked candidate vocabulary. Two entry points:
 *  - `radarScan` is called by the popup; it asks the PAGE (which has the
 *    article text and the correct tab context) to analyse itself. This avoids
 *    the old bug where the worker re-queried the active tab while the popup was
 *    focused and resolved to the popup window (no page text → empty results).
 *  - `radarAnalyze` is the page-side worker; it runs the shared AI pipeline
 *    (chunks/validates/merges/ranks) and respects cache + partial failures.
 * The natural-language goal text (from Settings) is the source of truth.
 */
export async function radarAnalyze(
  deps: BackgroundDeps,
  payload: { goal: string; pageUrl: string; pageText: string },
): Promise<import('@/features/radar/radar-service').AnalyzePageResult> {
  const settings = await deps.settings.get();
  const goal = payload.goal.trim();
  if (!goal) {
    throw new AiError('config', 'Set a Radar goal in Settings first.');
  }
  const pageText = payload.pageText;
  if (!pageText || !pageText.trim()) {
    return { candidates: [], chunksAnalyzed: 0, chunksTotal: 0, partial: false };
  }
  return deps.radarService.analyzePage(settings, {
    goal,
    pageText,
    pageUrl: payload.pageUrl,
  });
}

/**
 * Popup entry point. Ask the active tab's content script to scan itself
 * (`radar:scan` → `radar:analyze` with the page's own extracted text). Returns
 * the ranked candidates so the popup can show them without a tab round-trip.
 */
export async function radarScan(): Promise<import('@/features/radar/radar-service').AnalyzePageResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new AiError('config', 'No active page to scan.');
  }
  try {
    const result = await sendToTab(tab.id, { type: 'radar:scan' });
    return result as import('@/features/radar/radar-service').AnalyzePageResult;
  } catch {
    throw new AiError('config', 'Could not read the page content (try reloading the page).');
  }
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
        message.payload.language,
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
    'radar:scan': () => radarScan(),
    'radar:analyze': (message) => radarAnalyze(deps, message.payload),
  };
}
