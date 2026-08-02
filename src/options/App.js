import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useSettings } from '@/shared/hooks/useSettings';
import { AppearanceSettings } from '@/features/settings/AppearanceSettings';
import { DataSettings } from '@/features/settings/DataSettings';
import { ProviderSettings } from '@/features/settings/ProviderSettings';
import { Spinner } from '@/shared/ui/Spinner';
export function App() {
    const { settings, loading, update } = useSettings();
    return (_jsxs("main", { className: "mx-auto flex max-w-2xl flex-col gap-8 p-6", children: [_jsxs("header", { children: [_jsx("h1", { className: "text-lg font-semibold", children: "AI Vocabulary Saver \u2014 Settings" }), _jsx("p", { className: "mt-1 text-xs text-slate-500 dark:text-slate-400", children: "Local-first. No account, no backend, no telemetry." })] }), loading ? (_jsx(Spinner, { label: "Loading settings\u2026" })) : (_jsxs(_Fragment, { children: [_jsx(ProviderSettings, { settings: settings, onChange: update }), _jsx(AppearanceSettings, { settings: settings, onChange: update }), _jsx(DataSettings, {})] }))] }));
}
