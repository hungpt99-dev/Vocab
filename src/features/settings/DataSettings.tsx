import { useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { backupFilename, createBackup, parseBackup, restoreBackup } from './backup';

/** Export and import the local vocabulary database as JSON. */
export function DataSettings({ onChanged }: { onChanged?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);

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
      setStatus({ message: `Exported ${backup.entries.length} words.`, ok: true });
    } catch (cause) {
      setStatus({ message: cause instanceof Error ? cause.message : 'Export failed.', ok: false });
    }
  };

  const importData = async (file: File): Promise<void> => {
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      const { imported, skipped } = await restoreBackup(backup, mode);
      setStatus({ message: `Imported ${imported} words (${skipped} skipped).`, ok: true });
      onChanged?.();
    } catch (cause) {
      setStatus({ message: cause instanceof Error ? cause.message : 'Import failed.', ok: false });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section aria-labelledby="data-heading" className="flex flex-col gap-3">
      <h2 id="data-heading" className="text-sm font-semibold">
        Your data
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Everything is stored locally in this browser. Export regularly to keep a backup.
      </p>

      <fieldset className="flex items-center gap-4 text-sm">
        <legend className="sr-only">Import strategy</legend>
        {(['merge', 'replace'] as const).map((value) => (
          <label key={value} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="import-mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {value === 'merge' ? 'Merge with existing' : 'Replace everything'}
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => void exportData()}>
          Export JSON
        </Button>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
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

      {status && (
        <p
          role="status"
          className={`text-xs ${status.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {status.message}
        </p>
      )}
    </section>
  );
}
