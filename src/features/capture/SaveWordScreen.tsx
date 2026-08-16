import { useCallback, useEffect, useState } from 'react';
import type { SelectionPayload } from '@/shared/messaging/contract';
import type { VocabularyEntry, Explanation } from '@/shared/types/vocabulary';
import { sendMessage } from '@/shared/messaging/client';
import { useVocabulary } from '@/shared/hooks/useVocabulary';
import { vocabularyRepository } from '@/storage/vocabulary-repository';
import { takePendingExplain } from '@/content/pending-explain';
import { useAiAvailable } from '@/shared/hooks/useAiAvailable';
import { Button } from '@/shared/ui/Button';
import { ToastProvider, useToast } from '@/shared/ui/Toast';
import { ArrowLeftIcon, SparklesIcon } from '@/shared/ui/Icons';
import { ExplanationView } from '@/features/library/ExplanationView';
import { aiErrorMessage } from '@/ai/types';
import { readEnrichSession, writeEnrichSession, type EnrichSession } from './enrich-session';
import { SaveForm } from './SaveForm';

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
  const { available: aiAvailable } = useAiAvailable();

  // Pull the library so we can push explain results onto existing entries while
  // on the save page (same behaviour the dashboard had when the form was inline).
  const { update } = useVocabulary({
    search: '',
    favoritesOnly: false,
    tag: '',
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });

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

  // Resume a popup that was reopened mid-enrich: restore any finished result so
  // a reload doesn't wipe it. We deliberately never restore the loading flag —
  // the background worker settles the session when the call actually finishes
  // (see `settleEnrichSession`), so a stored `enriching: true` may describe a
  // call that already completed while the popup was closed, or one whose worker
  // died. Restoring it would revive a phantom spinner that can never clear.
  useEffect(() => {
    let cancelled = false;
    void readEnrichSession().then((s) => {
      if (cancelled || !s || s.word !== enrichWord) return;
      if (s.explanation) setEnrich({ word: s.word, explanation: s.explanation });
    });
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'local' || !('avs:enrich-session' in changes)) return;
      const s = changes['avs:enrich-session'].newValue as EnrichSession | undefined;
      if (!s || s.word !== enrichWord) {
        setEnriching(false);
        if (!s) setEnrich((prev) => (prev && prev.word === enrichWord ? prev : null));
        return;
      }
      setEnriching(s.enriching);
      setEnrich(s.explanation ? { word: s.word, explanation: s.explanation } : null);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [enrichWord]);

  const handleEnrich = useCallback(async () => {
    const target = enrichWord;
    if (!target) return;
    setEnriching(true);
    // Persist the loading flag BEFORE the AI round-trip so a popup reload that
    // lands during the call reads a committed session and shows the spinner.
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

        {/* Single AI action: enrich the word before saving. */}
        <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              AI enrichment
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={!enrichWord || enriching || !aiAvailable}
              title={
                !enrichWord
                  ? 'Type or select a word first'
                  : aiAvailable
                    ? undefined
                    : 'AI actions need an API key in settings'
              }
              onClick={() => void handleEnrich()}
            >
              <SparklesIcon size={14} className="mr-1.5" aria-hidden="true" />
              {enriching ? 'Enriching…' : enrich?.word === enrichWord ? 'Re-enrich' : 'AI enrich'}
            </Button>
          </div>
          {enrich?.word === enrichWord && (
            <div className="mt-2">
              <ExplanationView explanation={enrich.explanation} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
