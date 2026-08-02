import { useSettings } from '@/shared/hooks/useSettings';
import { AppearanceSettings } from '@/features/settings/AppearanceSettings';
import { DataSettings } from '@/features/settings/DataSettings';
import { ProviderSettings } from '@/features/settings/ProviderSettings';
import { Spinner } from '@/shared/ui/Spinner';
import { ToastProvider, useToast } from '@/shared/ui/Toast';
import { SettingsIcon } from '@/shared/ui/Icons';

function SettingsScreen() {
  const { settings, loading, update } = useSettings();
  const { notify } = useToast();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <header className="flex items-center gap-2 border-b border-slate-200 pb-4 dark:border-slate-700">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
          <SettingsIcon size={16} />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            AI Vocabulary Saver — Settings
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Local-first. No account, no backend, no telemetry.
          </p>
        </div>
      </header>

      {loading ? (
        <Spinner label="Loading settings…" />
      ) : (
        <>
          <ProviderSettings settings={settings} onChange={update} notify={notify} />
          <AppearanceSettings settings={settings} onChange={update} />
          <DataSettings notify={notify} />
        </>
      )}
    </main>
  );
}

export function App() {
  return (
    <ToastProvider>
      <SettingsScreen />
    </ToastProvider>
  );
}
