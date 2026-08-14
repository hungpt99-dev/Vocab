import { useCallback, useEffect, useState } from 'react';
import type { SelectionPayload } from '@/shared/messaging/contract';
import type { ExplainKind } from '@/shared/types/ai';
import type { VocabularyEntry, Explanation } from '@/shared/types/vocabulary';
import { sendMessage } from '@/shared/messaging/client';
import { useVocabulary } from '@/shared/hooks/useVocabulary';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { takePendingExplain } from '@/content/pending-explain';
import { useAiAvailable } from '@/shared/hooks/useAiAvailable';
import { useSettings } from '@/shared/hooks/useSettings';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { ToastProvider, useToast } from '@/shared/ui/Toast';
import { ArrowLeftIcon, SparklesIcon, WandIcon } from '@/shared/ui/Icons';
import { ExplanationView } from '@/features/library/ExplanationView';
import { aiErrorMessage } from '@/ai/types';
import { SaveForm } from './SaveForm';
import { WordCard } from './WordCard';

// Durable in-flight state for the popup's AI explain/enrich actions. The popup
// can close and reopen mid-call (it remounts on blur), which wipes volatile React
// state and makes the loading spinner vanish. We mirror the explain session in
// storage so a reloaded popup resumes the spinner and keeps the result — same
// durable pattern as `avs:pending-explain`.
const ENRICH_SESSION_KEY = 'avs:enrich-session';
interface EnrichSession {
  word: string;
  kind: ExplainKind | null;
  enriching: boolean;
  explanation: Explanation | null;
}
const readEnrichSession = (): Promise<EnrichSession | null> =>
  new Promise((resolve) => {
    chrome.storage.local.get(ENRICH_SESSION_KEY, (v) =>
      resolve((v[ENRICH_SESSION_KEY] as EnrichSession | undefined) ?? null),
    );
  });
const writeEnrichSession = (s: EnrichSession | null): void => {
  if (s) chrome.storage.local.set({ [ENRICH_SESSION_KEY]: s });
  else chrome.storage.local.remove(ENRICH_SESSION_KEY);
};

/** Contextual AI actions shown under the enrich panel — part of the learning
 * flow, not a separate chat. Each maps to an ExplainKind already supported by
 * the explain service. */
const CONTEXT_ACTIONS: ReadonlyArray<{ kind: ExplainKind; label: string }> = [
  { kind: 'sentence', label: 'Explain sentence' },
  { kind: 'examples', label: 'Give examples' },
  { kind: 'native', label: 'In my language' },
];

export interface SaveWordScreenProps {
  /** Called after a word is saved, so the dashboard can refresh its stats. */
  onSaved: () => void;
  /** Called when the user navigates back to the dashboard. */
  onBack: () => void;
}

/** Dedicated page for saving a new vocabulary word. Decoupled from the
 * dashboard so adding a word is an explicit action, not an inline form. */
export function SaveWordScreen({ onSaved, onBack }: SaveWordScreenProps) {
  return (
    <ToastProvider>
      <SaveWordScreenInner onSaved={onSaved} onBack={onBack} />
    </ToastProvider>
  );
}

function SaveWordScreenInner({ onSaved, onBack }: SaveWordScreenProps) {
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [saving, setSaving] = useState(false);
  // Inline enrich for the highlighted word: held in the popup until the word is
  // saved, so the rich AI data is attached on save (no separate popup window).
  const [enrich, setEnrich] = useState<{ word: string; explanation: Explanation } | null>(null);
  const [enriching, setEnriching] = useState(false);
  // The word the user is working with: from a page highlight OR typed into the
  // form. Either way it can be enriched inline before saving.
  const [word, setWord] = useState('');
  const { notify } = useToast();
  const { settings } = useSettings();
  const { available: aiAvailable } = useAiAvailable();
  const [alreadySaved, setAlreadySaved] = useState(false);

  // Pull the library so we can push related-vocab results onto existing entries
  // while on the save page (same behaviour the dashboard had when the form was
  // inline). We only need `update` here, not the list.
  const { update } = useVocabulary({
    search: '',
    favoritesOnly: false,
    tag: '',
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });

  // Track whether the current word is already in the library (drives the Save button).
  useEffect(() => {
    const w = selection?.word.trim();
    if (!w) {
      setAlreadySaved(false);
      return;
    }
    let cancelled = false;
    void vocabularyRepository.findByWord(w).then((entry) => {
      if (!cancelled) setAlreadySaved(Boolean(entry));
    });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  useEffect(() => {
    const readSelection = (): void => {
      void (async () => {
        try {
          setSelection(await sendMessage({ type: 'get-selection' }));
        } catch {
          setSelection(null);
        }
      })();
    };
    readSelection();
    // Re-read the page selection whenever the popup regains focus, so it always
    // reflects the word the user just highlighted before opening the popup.
    window.addEventListener('focus', readSelection);
    return () => window.removeEventListener('focus', readSelection);
  }, []);

  const handleSave = useCallback(
    async ({ word: savedWord, note, tags: newTags }: { word: string; note: string; tags: string[] }) => {
      setSaving(true);
      try {
        // Attach any inline enrich data for the highlighted word when it matches.
        const explanation =
          enrich && enrich.word.toLowerCase() === savedWord.toLowerCase() ? enrich.explanation : null;
        await vocabularyRepository.save({
          word: savedWord,
          note,
          tags: newTags,
          sentence: selection?.word === savedWord ? selection.sentence : '',
          sourceUrl: selection?.sourceUrl ?? '',
          sourceTitle: selection?.sourceTitle ?? '',
          sourceLanguage: selection?.sourceLanguage ?? '',
          explanation,
        });
        if (explanation) setEnrich(null);
        notify(`Saved “${savedWord}”.`, 'success');
        await onSaved();
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Could not save that word.', 'error');
      } finally {
        setSaving(false);
      }
    },
    [enrich, selection, notify, onSaved],
  );

  const enrichWord = selection?.word ?? word;

  // Resume a popup that was reopened mid-explain: restore the loading spinner and
  // any finished result so a reload doesn't wipe the in-flight state (the AI call
  // keeps running in the background worker).
  useEffect(() => {
    let cancelled = false;
    void readEnrichSession().then((s) => {
      if (cancelled || !s || s.word !== enrichWord) return;
      if (s.enriching) setEnriching(true);
      if (s.kind) setExplainKind(s.kind);
      if (s.explanation) setEnrich({ word: s.word, explanation: s.explanation });
    });
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'local' || !('avs:enrich-session' in changes)) return;
      const s = changes['avs:enrich-session'].newValue as EnrichSession | undefined;
      if (!s || s.word !== enrichWord) {
        setEnriching(false);
        setExplainKind(null);
        if (!s) setEnrich((prev) => (prev && prev.word === enrichWord ? prev : null));
        return;
      }
      setEnriching(s.enriching);
      setExplainKind(s.kind);
      setEnrich(s.explanation ? { word: s.word, explanation: s.explanation } : null);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [enrichWord]);

  const [explainKind, setExplainKind] = useState<ExplainKind | null>(null);

  const handleExplainKind = useCallback(
    async (kind: ExplainKind) => {
      const target = enrichWord;
      if (!target) return;
      setExplainKind(kind);
      // Persist the loading flag BEFORE the AI round-trip so a popup reload
      // (close/reopen on blur) that lands during the call reads a committed
      // session and shows the spinner — not an empty one.
      await writeEnrichSession({ word: target, kind, enriching: false, explanation: null });
      try {
        const explanation = await sendMessage({
          type: 'explain',
          payload: {
            word: target,
            context: selection?.sentence,
            pageTitle: selection?.sourceTitle,
            language: settings.targetLanguage || 'English',
            kind,
          },
        });
        setEnrich({ word: target, explanation });
        await writeEnrichSession({ word: target, kind: null, enriching: false, explanation });
      } catch (cause) {
        notify(aiErrorMessage(cause), 'error');
        await writeEnrichSession(null);
      } finally {
        setExplainKind(null);
      }
    },
    [enrichWord, selection, settings.targetLanguage, notify],
  );

  const [generatingRelated, setGeneratingRelated] = useState(false);

  const handleGenerateRelated = useCallback(async () => {
    const target = enrichWord;
    if (!target) return;
    setGeneratingRelated(true);
    try {
      const explanation = await sendMessage({
        type: 'explain',
        payload: {
          word: target,
          context: selection?.sentence,
          pageTitle: selection?.sourceTitle,
          language: settings.targetLanguage || 'English',
          kind: 'related',
        },
      });
      // Persist the generated related vocabulary onto the entry's explanation.
      const related = [
        ...(explanation.relatedWords ?? []),
        ...(explanation.relatedPhrases ?? []),
      ].filter(Boolean);
      const entry = await vocabularyRepository.findByWord(target);
      if (entry) {
        const merged = new Set([...(entry.explanation?.relatedWords ?? []), ...related]);
        await update(entry.id, {
          explanation: {
            ...(entry.explanation ?? explanation),
            relatedWords: [...merged],
            relatedPhrases: explanation.relatedPhrases ?? entry.explanation?.relatedPhrases ?? [],
          },
        });
      }
      setEnrich({ word: target, explanation: { ...explanation, relatedWords: [...related] } });
      await onSaved();
      notify(`Added ${related.length} related term${related.length === 1 ? '' : 's'}.`, 'success');
    } catch (cause) {
      notify(aiErrorMessage(cause), 'error');
    } finally {
      setGeneratingRelated(false);
    }
  }, [enrichWord, selection, settings.targetLanguage, update, notify, onSaved]);

  const handleEnrich = useCallback(async () => {
    const target = enrichWord;
    if (!target) return;
    setEnriching(true);
    // Persist the loading flag BEFORE the AI round-trip (see handleExplainKind).
    await writeEnrichSession({ word: target, kind: null, enriching: true, explanation: null });
    try {
      const explanation = await sendMessage({
        type: 'explain',
        payload: { word: target, context: selection?.sentence, pageTitle: selection?.sourceTitle },
      });
      setEnrich({ word: target, explanation });
      writeEnrichSession({ word: target, kind: null, enriching: false, explanation });
    } catch (cause) {
      notify(aiErrorMessage(cause), 'error');
      writeEnrichSession(null);
    } finally {
      setEnriching(false);
    }
  }, [enrichWord, selection, notify]);

  const handleExplain = useCallback(
    async (entry: VocabularyEntry) => {
      try {
        const explanation = await sendMessage({
          type: 'explain',
          payload: { word: entry.word, context: entry.sentence, pageTitle: entry.sourceTitle },
        });
        await update(entry.id, { explanation });
      } catch (cause) {
        notify(aiErrorMessage(cause), 'error');
      }
    },
    [update, notify],
  );

  // When the page toolbar asks to explain a word, it hands the word off here so
  // the save page is the single explain surface. Explain an existing entry, or
  // save it first, then run the explain flow.
  useEffect(() => {
    let cancelled = false;

    const runPending = async (): Promise<void> => {
      const pending = await takePendingExplain();
      if (!pending || pending.word.trim() === '') return;
      const w = pending.word.trim();
      try {
        let entry = await vocabularyRepository.findByWord(w);
        if (!entry) {
          entry = await vocabularyRepository.save({
            word: w,
            sentence: pending.context ?? '',
          });
        }
        if (!cancelled) await handleExplain(entry);
      } catch (cause) {
        if (!cancelled) notify(aiErrorMessage(cause), 'error');
      }
    };

    void runPending();
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };

    function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, area: string): void {
      if (area === 'local' && 'avs:pending-explain' in changes) void runPending();
    }
  }, [handleExplain, notify]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Page header with clear back navigation to the dashboard. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to dashboard"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeftIcon size={18} aria-hidden="true" />
        </button>
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Save new word
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SaveForm
          selection={selection}
          saving={saving}
          word={word}
          onWordChange={setWord}
          onSave={handleSave}
        />
        <WordCard
          selection={selection}
          alreadySaved={alreadySaved}
          saving={saving}
          showTranslation={settings.popupShowTranslation}
          showSimplify={settings.popupShowSimplify}
          onSave={() => void handleSave({ word: enrichWord, note: '', tags: [] })}
          onSimplify={() => void handleExplainKind('simplify')}
          simplifying={explainKind === 'simplify'}
          aiUnavailableHint={
            aiAvailable ? undefined : 'AI actions need an API key — open settings.'
          }
        />

        {enrichWord && (
          <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {enrichWord}
              </p>
              <Button
                size="sm"
                variant="secondary"
                disabled={enriching || !aiAvailable}
                title={aiAvailable ? undefined : 'AI actions need an API key in settings'}
                onClick={() => void handleEnrich()}
              >
                <SparklesIcon size={14} className="mr-1.5" aria-hidden="true" />
                {enriching ? 'Enriching…' : enrich?.word === enrichWord ? 'Re-enrich' : 'AI enrich'}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CONTEXT_ACTIONS.map((action) => (
                <Button
                  key={action.kind}
                  size="sm"
                  variant="ghost"
                  disabled={explainKind !== null || !aiAvailable}
                  onClick={() => void handleExplainKind(action.kind)}
                  title={aiAvailable ? action.label : 'AI actions need an API key in settings'}
                >
                  {explainKind === action.kind ? <Spinner label="Loading…" /> : action.label}
                </Button>
              ))}
            </div>
            <div className="mt-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={generatingRelated || !aiAvailable}
                onClick={() => void handleGenerateRelated()}
                title={aiAvailable ? 'Use AI to suggest related vocabulary' : 'AI actions need an API key in settings'}
              >
                <WandIcon size={14} className="mr-1.5" aria-hidden="true" />
                {generatingRelated ? 'Generating…' : 'Generate related vocabulary'}
              </Button>
            </div>
            {selection?.word === enrichWord && selection.sentence && (
              <p className="mt-0.5 line-clamp-2 text-xs italic text-slate-500 dark:text-slate-400">
                “{selection.sentence}”
              </p>
            )}
            {enrich?.word === enrichWord && (
              <div className="mt-2">
                <ExplanationView explanation={enrich.explanation} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
