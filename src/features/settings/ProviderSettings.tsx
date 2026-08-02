import { useState } from 'react';
import type { Settings } from '@/shared/types/settings';
import { AI_PROVIDER_IDS, type AiProviderId } from '@/shared/types/settings';
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

export interface ProviderSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
  notify: (message: string, variant?: 'success' | 'error' | 'info') => void;
}

function isProviderId(value: string): value is AiProviderId {
  return (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

export function ProviderSettings({ settings, onChange, notify }: ProviderSettingsProps) {
  const [testing, setTesting] = useState(false);

  const provider = getProvider(settings.provider);

  const test = async (): Promise<void> => {
    setTesting(true);
    try {
      await new ExplainService().explainWith(settings, { word: 'test' });
      notify(`Connected to ${provider.label}.`, 'success');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Connection failed.', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section aria-labelledby="provider-heading" className="flex flex-col gap-3">
      <h2 id="provider-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        AI provider
      </h2>

      <Select
        label="Provider"
        value={settings.provider}
        options={PROVIDER_OPTIONS}
        onChange={(event) => {
          const value = event.target.value;
          if (isProviderId(value)) void onChange({ provider: value });
        }}
        hint="Your key never leaves this browser — requests go straight to the provider."
      />

      <TextField
        label="API key"
        type="password"
        autoComplete="off"
        value={settings.apiKey}
        onChange={(event) => void onChange({ apiKey: event.target.value })}
        placeholder={provider.requiresApiKey ? 'Required' : 'Not required for local runtimes'}
      />

      <TextField
        label="Model"
        value={settings.model}
        onChange={(event) => void onChange({ model: event.target.value })}
        placeholder={provider.defaultModel}
        hint={`Leave blank to use ${provider.defaultModel}.`}
      />

      <TextField
        label="Base URL"
        value={settings.baseUrl}
        onChange={(event) => void onChange({ baseUrl: event.target.value })}
        placeholder={provider.defaultBaseUrl}
        hint="Override for proxies or local servers."
      />

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => void test()} disabled={testing}>
          Test connection
        </Button>
        {testing && <Spinner label="Testing…" />}
      </div>
    </section>
  );
}
