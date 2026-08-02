import { broadcast, sendToTab } from '@/shared/messaging/client';
import { explainService as defaultExplainService } from '@/ai/explain-service';
import { settingsRepository as defaultSettingsRepository, } from '@/storage/settings-repository';
import { vocabularyRepository as defaultVocabularyRepository, } from '@/storage/vocabulary-repository';
export const defaultDeps = {
    vocabulary: defaultVocabularyRepository,
    settings: defaultSettingsRepository,
    explain: defaultExplainService,
};
/** Read the current selection from the active tab, if any. */
export async function readActiveSelection() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id)
        return null;
    return sendToTab(tab.id, { type: 'get-selection' });
}
/** Persist a selection and notify every surface that data changed. */
export async function saveSelection(deps, selection) {
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
            });
            return await deps.vocabulary.update(entry.id, { explanation });
        }
        catch {
            // Auto-explain is best-effort; the entry is already safely stored.
        }
    }
    return entry;
}
export async function buildHighlightData(deps) {
    const [settings, entries] = await Promise.all([
        deps.settings.get(),
        deps.vocabulary.list({ sortBy: 'word', sortDirection: 'asc' }),
    ]);
    return {
        enabled: settings.highlightEnabled,
        color: settings.highlightColor,
        entries: entries.map((entry) => ({
            id: entry.id,
            word: entry.word,
            wordKey: entry.wordKey,
            note: entry.note,
            createdAt: entry.createdAt,
            meaning: entry.explanation?.meaning ?? '',
        })),
    };
}
export async function explainWord(deps, word, context) {
    const explanation = await deps.explain.explain({ word, context });
    const existing = await deps.vocabulary.findByWord(word);
    if (existing) {
        await deps.vocabulary.update(existing.id, { explanation });
        await broadcast({ type: 'vocabulary-changed' });
    }
    return explanation;
}
/** Build the handler map used by the service worker's message router. */
export function createHandlers(deps = defaultDeps) {
    return {
        'save-entry': async (message) => {
            const entry = await deps.vocabulary.save(message.payload);
            await broadcast({ type: 'vocabulary-changed' });
            return entry;
        },
        'save-current-selection': async () => {
            const selection = await readActiveSelection();
            if (!selection?.word.trim())
                return null;
            const entry = await saveSelection(deps, selection);
            await broadcast({ type: 'vocabulary-changed' });
            return entry;
        },
        'get-highlight-data': () => buildHighlightData(deps),
        explain: (message) => explainWord(deps, message.payload.word, message.payload.context),
        'vocabulary-changed': () => undefined,
        'settings-changed': () => undefined,
    };
}
