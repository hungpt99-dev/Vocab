import { useState } from 'react';
import { useSettings } from '@/shared/hooks/useSettings';
import { ProviderSettings } from '@/features/settings/ProviderSettings';
import { BilingualSettings } from '@/features/settings/BilingualSettings';
import { RadarSettings } from '@/features/settings/RadarSettings';
import { AppearanceSettings } from '@/features/settings/AppearanceSettings';
import { PopupSettings } from '@/features/settings/PopupSettings';
import { DataSettings } from '@/features/settings/DataSettings';
import { Spinner } from '@/shared/ui/Spinner';
import { ToastProvider, useToast } from '@/shared/ui/Toast';
import { SettingsIcon, KeyIcon, LanguagesIcon, TargetIcon, PaletteIcon, DatabaseIcon, SlidersIcon } from '@/shared/ui/Icons';

type SectionId = 'providers' | 'bilingual' | 'radar' | 'popup' | 'appearance' | 'data';

interface NavItem {
  id: SectionId;
  label: string;
  icon: typeof SettingsIcon;
}

const NAV: NavItem[] = [
  { id: 'providers', label: 'AI providers', icon: KeyIcon },
  { id: 'bilingual', label: 'Reading', icon: LanguagesIcon },
  { id: 'radar', label: 'Vocabulary Radar', icon: TargetIcon },
  { id: 'popup', label: 'Popup', icon: SlidersIcon },
  { id: 'appearance', label: 'Appearance', icon: PaletteIcon },
  { id: 'data', label: 'Your data', icon: DatabaseIcon },
];

function SettingsScreen() {
  const { settings, loading, update } = useSettings();
  const { notify } = useToast();
  const [active, setActive] = useState<SectionId>('providers');

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl gap-8 px-6 py-8">
      {/* Sidebar */}
      <aside className="sticky top-8 hidden h-fit w-56 shrink-0 flex-col gap-1 md:flex">
        <div className="mb-3 flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <SettingsIcon size={18} />
          </span>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">vocab</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="Settings sections">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <p className="mt-4 px-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
          Local-first. No account, no backend, no telemetry.
        </p>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1">
        <header className="mb-6 flex items-center gap-3 md:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <SettingsIcon size={18} />
          </span>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
        </header>

        {loading ? (
          <Spinner label="Loading settings…" />
        ) : (
          <div className="flex flex-col gap-6">
            {active === 'providers' && (
              <div
                id="providers"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <ProviderSettings settings={settings} onChange={update} />
              </div>
            )}

            {active === 'bilingual' && (
              <div
                id="bilingual"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <BilingualSettings settings={settings} onChange={update} />
              </div>
            )}

            {active === 'radar' && (
              <div
                id="radar"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <RadarSettings settings={settings} onChange={update} />
              </div>
            )}

            {active === 'popup' && (
              <div
                id="popup"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <PopupSettings settings={settings} onChange={update} />
              </div>
            )}

            {active === 'appearance' && (
              <div
                id="appearance"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <AppearanceSettings settings={settings} onChange={update} />
              </div>
            )}

            {active === 'data' && (
              <div
                id="data"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <DataSettings notify={notify} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <SettingsScreen />
    </ToastProvider>
  );
}
