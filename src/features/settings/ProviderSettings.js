import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { AI_PROVIDER_IDS } from '@/shared/types/settings';
import { getProvider, listProviders } from '@/ai/registry';
import { ExplainService } from '@/ai/explain-service';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { TextField } from '@/shared/ui/TextField';
import { Spinner } from '@/shared/ui/Spinner';
const PROVIDER_OPTIONS = listProviders().map((provider) => ({
    value: provider.id,
    label: provider.label,
}));
function isProviderId(value) {
    return AI_PROVIDER_IDS.includes(value);
}
export function ProviderSettings({ settings, onChange }) {
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState(null);
    const provider = getProvider(settings.provider);
    const test = async () => {
        setTesting(true);
        setResult(null);
        try {
            await new ExplainService().explainWith(settings, { word: 'test' });
            setResult({ message: `Connected to ${provider.label}.`, ok: true });
        }
        catch (cause) {
            setResult({
                message: cause instanceof Error ? cause.message : 'Connection failed.',
                ok: false,
            });
        }
        finally {
            setTesting(false);
        }
    };
    return (_jsxs("section", { "aria-labelledby": "provider-heading", className: "flex flex-col gap-3", children: [_jsx("h2", { id: "provider-heading", className: "text-sm font-semibold", children: "AI provider" }), _jsx(Select, { label: "Provider", value: settings.provider, options: PROVIDER_OPTIONS, onChange: (event) => {
                    const value = event.target.value;
                    if (isProviderId(value))
                        void onChange({ provider: value });
                }, hint: "Your key never leaves this browser \u2014 requests go straight to the provider." }), _jsx(TextField, { label: "API key", type: "password", autoComplete: "off", value: settings.apiKey, onChange: (event) => void onChange({ apiKey: event.target.value }), placeholder: provider.requiresApiKey ? 'Required' : 'Not required for local runtimes' }), _jsx(TextField, { label: "Model", value: settings.model, onChange: (event) => void onChange({ model: event.target.value }), placeholder: provider.defaultModel, hint: `Leave blank to use ${provider.defaultModel}.` }), _jsx(TextField, { label: "Base URL", value: settings.baseUrl, onChange: (event) => void onChange({ baseUrl: event.target.value }), placeholder: provider.defaultBaseUrl, hint: "Override for proxies or local servers." }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { variant: "secondary", onClick: () => void test(), disabled: testing, children: "Test connection" }), testing && _jsx(Spinner, { label: "Testing\u2026" }), result && (_jsx("p", { role: "status", className: `text-xs ${result.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`, children: result.message }))] })] }));
}
