import { useSettings } from '@/shared/hooks/useSettings';
import { AppearanceSettings } from '@/features/settings/AppearanceSettings';
import { DataSettings } from '@/features/settings/DataSettings';
import { ProviderSettings } from '@/features/settings/ProviderSettings';
import { Spinner } from '@/shared/ui/Spinner';

export function App() {
  const { settings, loading, update } = useSettings();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-lg font-semibold">AI Vocabulary Saver — Settings</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Local-first. No account, no backend, no telemetry.
        </p>
      </header>

      {loading ? (
        <Spinner label="Loading settings…" />
      ) : (
        <>
          <ProviderSettings settings={settings} onChange={update} />
          <AppearanceSettings settings={settings} onChange={update} />
          <DataSettings />
        </>
      )}
    </main>
  );
}
