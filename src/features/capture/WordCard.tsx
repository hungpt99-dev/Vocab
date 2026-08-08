import { useCallback, useEffect, useState } from 'react';
import type { SelectionPayload } from '@/shared/messaging/contract';
import { sendMessage } from '@/shared/messaging/client';
import { aiErrorMessage } from '@/ai/types';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { BookMarkedIcon, SettingsIcon, WandIcon } from '@/shared/ui/Icons';
import { useAiAvailable } from '@/shared/hooks/useAiAvailable';

export interface WordCardProps {
  selection: SelectionPayload | null;
  /** Whether the word is already saved (so Save becomes 'Saved'). */
  alreadySaved?: boolean;
  onSave: () => void;
  saving?: boolean;
  /** Auto-fetch the keyless translation on open. */
  showTranslation: boolean;
  /** Show the Simplify action. */
  showSimplify: boolean;
  /** Called when the user asks to simplify the word (AI). */
  onSimplify?: () => void;
  simplifying?: boolean;
  /** Human-readable reason the AI gate is shown, if any. */
  aiUnavailableHint?: string;
}

/**
 * Translation-first centerpiece of the popup. Shows the highlighted word and
 * its keyless translation inline (translation works without an AI key), with
 * Save inline. AI actions are shown separately and greyed when no AI key is
 * configured.
 */
export function WordCard({
  selection,
  alreadySaved,
  onSave,
  saving,
  showTranslation,
  showSimplify,
  onSimplify,
  simplifying,
  aiUnavailableHint,
}: WordCardProps) {
  const text = selection?.word.trim() ?? '';
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');
  const { available } = useAiAvailable();

  // Auto-translate the highlighted word as soon as a new selection arrives.
  const translate = useCallback(async () => {
    if (!text || !showTranslation) return;
    setTranslating(true);
    setError('');
    setTranslation('');
    try {
      setTranslation(await sendMessage({ type: 'translate', payload: { text } }));
    } catch (cause) {
      setError(aiErrorMessage(cause));
    } finally {
      setTranslating(false);
    }
  }, [text, showTranslation]);

  useEffect(() => {
    void translate();
  }, [translate]);

  if (!text) return null;

  return (
    <div className="border-b border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{text}</p>
          {translating && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
              <Spinner /> Translating…
            </p>
          )}
          {translation && !translating && (
            <p className="mt-0.5 text-sm text-brand-700 dark:text-brand-300">{translation}</p>
          )}
          {error && (
            <p role="alert" className="mt-0.5 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant={alreadySaved ? 'ghost' : 'secondary'}
          disabled={saving || alreadySaved}
          onClick={onSave}
          title={alreadySaved ? 'Already in your library' : 'Save this word'}
        >
          <BookMarkedIcon size={14} className="mr-1.5" aria-hidden="true" />
          {alreadySaved ? 'Saved' : saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {showSimplify && (
        <div className="mt-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={simplifying || !available}
            title={available ? 'Explain the word in plain language' : (aiUnavailableHint ?? 'AI actions need an API key in settings')}
            onClick={() => onSimplify?.()}
          >
            <WandIcon size={14} className="mr-1.5" aria-hidden="true" />
            {simplifying ? 'Simplifying…' : 'Simplify'}
          </Button>
        </div>
      )}

      {!available && (
        <button
          type="button"
          onClick={() => void chrome.runtime.openOptionsPage()}
          className="mt-2 flex w-full items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-left text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:text-slate-400 dark:hover:text-brand-300"
        >
          <SettingsIcon size={13} aria-hidden="true" />
          <span>{aiUnavailableHint ?? 'AI actions need an API key — open settings.'}</span>
        </button>
      )}
    </div>
  );
}
