import { useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { DownloadIcon, UploadIcon } from '@/shared/ui/Icons';
import { backupFilename, createBackup, parseBackup, restoreBackup } from './backup';

/** Export and import the local vocabulary database as JSON. */
export function DataSettings({ notify }: { notify: (message: string, variant?: 'success' | 'error' | 'info') => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');

  const exportData = async (): Promise<void> => {
    try {
      const backup = await createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFilename();
      link.click();
      URL.revokeObjectURL(url);
      notify(`Exported ${backup.entries.length} words.`, 'success');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Export failed.', 'error');
    }
  };

  const importData = async (file: File): Promise<void> => {
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      const { imported, skipped } = await restoreBackup(backup, mode);
      notify(`Imported ${imported} words (${skipped} skipped).`, 'success');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Import failed.', 'error');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section aria-labelledby="data-heading" className="flex flex-col gap-3">
      <h2 id="data-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Your data
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Everything is stored locally in this browser. Export regularly to keep a backup.
      </p>

      <fieldset className="flex items-center gap-4 text-sm">
        <legend className="sr-only">Import strategy</legend>
        {(['merge', 'replace'] as const).map((value) => (
          <label key={value} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <input
              type="radio"
              name="import-mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="h-4 w-4 text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900"
            />
            {value === 'merge' ? 'Merge with existing' : 'Replace everything'}
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => void exportData()}>
          <DownloadIcon size={14} />
          Export JSON
        </Button>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          <UploadIcon size={14} />
          Import JSON
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Choose a vocabulary backup file"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importData(file);
          }}
        />
      </div>
    </section>
  );
}
