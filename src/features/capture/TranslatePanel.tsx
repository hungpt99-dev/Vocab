import { useCallback, useState } from 'react';
import type { SelectionPayload } from '@/shared/messaging/contract';
import { sendMessage } from '@/shared/messaging/client';
import { aiErrorMessage } from '@/ai/types';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { LanguagesIcon } from '@/shared/ui/Icons';

export interface TranslatePanelProps {
  selection: SelectionPayload | null;
}

/**
 * Translate the current page selection and show the result inside the popup.
 * The translation is rendered here only — the page DOM is never touched.
 */
export function TranslatePanel({ selection }: TranslatePanelProps) {
  const text = selection?.word.trim() ?? '';
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');

  const translate = useCallback(async (): Promise<void> => {
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
  }, [text]);

  if (!text) return null;

  return (
    <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={translating} onClick={() => void translate()}>
          <LanguagesIcon size={14} className="mr-1.5" aria-hidden="true" />
          {translating ? 'Translating…' : 'Translate selection'}
        </Button>
        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
      {translating && (
        <div className="mt-2">
          <Spinner label="Translating…" />
        </div>
      )}
      {translation && (
        <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          {translation}
        </p>
      )}
    </div>
  );
}
