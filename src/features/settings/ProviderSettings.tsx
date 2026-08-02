import { useState } from 'react';
import type { Settings, SavedProvider, AiProviderId } from '@/shared/types/settings';
import { AI_PROVIDER_IDS } from '@/shared/types/settings';
import { getProvider } from '@/ai/registry';
import { explainService } from '@/ai/explain-service';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { TextField } from '@/shared/ui/TextField';
import { Select } from '@/shared/ui/Select';
import { Spinner } from '@/shared/ui/Spinner';
import { Badge } from '@/shared/ui/Badge';
import { CheckIcon, PlusIcon, TrashIcon, PencilIcon } from '@/shared/ui/Icons';
import { useToast } from '@/shared/ui/Toast';

const TYPE_OPTIONS = AI_PROVIDER_IDS.map((id) => ({
  value: id,
  label: getProvider(id).label,
}));

function newProvider(type: AiProviderId): SavedProvider {
  const preset = getProvider(type);
  return {
    id: crypto.randomUUID(),
    type,
    name: preset.label,
    apiKey: '',
    baseUrl: '',
    model: '',
    enabled: true,
  };
}

export interface ProviderSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}

/** Full multi-provider management surface: list, add, edit, remove, activate, fallback. */
export function ProviderSettings({ settings, onChange }: ProviderSettingsProps) {
  const { notify } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const providers = settings.providers;

  const persist = (next: SavedProvider[]): Promise<void> =>
    onChange({
      providers: next,
      activeProviderId: settings.activeProviderId,
      fallbackProviderId: settings.fallbackProviderId,
    });

  const addProvider = (provider: SavedProvider): Promise<void> =>
    persist([...providers, provider]);

  const updateProvider = (next: SavedProvider): Promise<void> =>
    persist(providers.map((p) => (p.id === next.id ? next : p)));

  const removeProvider = (id: string): Promise<void> => {
    const next = providers.filter((p) => p.id !== id);
    const patch: Partial<Settings> = { providers: next };
    if (settings.activeProviderId === id) patch.activeProviderId = next[0]?.id ?? '';
    if (settings.fallbackProviderId === id) patch.fallbackProviderId = undefined;
    return onChange(patch);
  };

  const setActive = (id: string): Promise<void> => onChange({ activeProviderId: id });

  const setFallback = (id: string): Promise<void> =>
    onChange({ fallbackProviderId: id === settings.activeProviderId ? undefined : id || undefined });

  const test = async (provider: SavedProvider): Promise<void> => {
    setTestingId(provider.id);
    const probe: Settings = { ...settings, providers, activeProviderId: provider.id };
    try {
      await explainService.explainWith(probe, { word: 'test' });
      notify(`Connected to ${provider.name}.`, 'success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Connection failed.';
      notify(message, 'error');
    } finally {
      setTestingId(null);
    }
  };

  return (
    <section aria-labelledby="provider-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="provider-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          AI providers
        </h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setEditingId('new')}
          disabled={editingId !== null}
        >
          <PlusIcon size={14} />
          Add provider
        </Button>
      </div>

      {editingId ? (
        <ProviderEditor
          initial={editingId === 'new' ? newProvider('openai') : providers.find((p) => p.id === editingId)}
          onCancel={() => setEditingId(null)}
          onSave={async (provider) => {
            if (editingId === 'new') {
              await addProvider(provider);
              if (providers.length === 0) await setActive(provider.id);
            } else {
              await updateProvider(provider);
            }
            setEditingId(null);
          }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {providers.map((provider) => {
            const preset = getProvider(provider.type);
            const isActive = provider.id === settings.activeProviderId;
            return (
              <li
                key={provider.id}
                className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {provider.name}
                      </p>
                      {isActive && <Badge>Active</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {preset.label}
                      {provider.model ? ` · ${provider.model}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton label={`Edit ${provider.name}`} onClick={() => setEditingId(provider.id)}>
                      <PencilIcon size={16} />
                    </IconButton>
                    <IconButton
                      label={`Remove ${provider.name}`}
                      onClick={() => void removeProvider(provider.id)}
                      disabled={providers.length <= 1}
                    >
                      <TrashIcon size={16} />
                    </IconButton>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant={isActive ? 'primary' : 'secondary'} onClick={() => void setActive(provider.id)}>
                    {isActive ? <CheckIcon size={14} /> : null}
                    {isActive ? 'Active' : 'Set active'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void test(provider)} disabled={testingId === provider.id}>
                    {testingId === provider.id ? <Spinner label="Testing…" /> : 'Test'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Select
        label="Fallback provider"
        value={settings.fallbackProviderId ?? ''}
        onChange={(event) => void setFallback(event.target.value)}
        options={[
          { value: '', label: 'None' },
          ...providers
            .filter((p) => p.id !== settings.activeProviderId)
            .map((p) => ({ value: p.id, label: p.name })),
        ]}
        hint="If the active provider fails (network, timeout, rate limit), one request is retried on this provider."
      />
    </section>
  );
}

interface ProviderEditorProps {
  initial?: SavedProvider;
  onCancel: () => void;
  onSave: (provider: SavedProvider) => Promise<void>;
}

function ProviderEditor({ initial, onCancel, onSave }: ProviderEditorProps) {
  const [draft, setDraft] = useState<SavedProvider>(
    initial ?? newProvider('openai'),
  );
  const [saving, setSaving] = useState(false);

  const preset = getProvider(draft.type);
  const set = <K extends keyof SavedProvider>(key: K, value: SavedProvider[K]): void =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (): Promise<void> => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <TextField
        label="Name"
        value={draft.name}
        onChange={(event) => set('name', event.target.value)}
        placeholder="My OpenAI GPT-5 Mini"
      />
      <Select
        label="Provider"
        value={draft.type}
        options={TYPE_OPTIONS}
        onChange={(event) => {
          const type = event.target.value as AiProviderId;
          const next = getProvider(type);
          setDraft((current) => ({
            ...current,
            type,
            name: current.name === preset.label ? next.label : current.name,
            model: current.model || '',
            baseUrl: current.baseUrl || '',
          }));
        }}
      />
      <TextField
        label="API key"
        type="password"
        autoComplete="off"
        value={draft.apiKey}
        onChange={(event) => set('apiKey', event.target.value)}
        placeholder={preset.requiresApiKey ? 'Required' : 'Not required for local runtimes'}
      />
      <TextField
        label="Base URL"
        value={draft.baseUrl}
        onChange={(event) => set('baseUrl', event.target.value)}
        placeholder={preset.defaultBaseUrl || 'https://…/v1'}
        hint={preset.defaultBaseUrl ? `Default: ${preset.defaultBaseUrl}` : 'Required for custom endpoints.'}
      />
      <TextField
        label="Model"
        value={draft.model}
        onChange={(event) => set('model', event.target.value)}
        placeholder={preset.defaultModel || 'e.g. gpt-4o-mini'}
        hint={preset.defaultModel ? `Default: ${preset.defaultModel}` : 'Required.'}
      />
      <div className="grid grid-cols-3 gap-2">
        <TextField
          label="Temperature"
          type="number"
          step="0.1"
          min="0"
          max="1"
          value={draft.temperature?.toString() ?? ''}
          onChange={(event) => set('temperature', event.target.value ? Number(event.target.value) : undefined)}
        />
        <TextField
          label="Max tokens"
          type="number"
          min="1"
          value={draft.maxTokens?.toString() ?? ''}
          onChange={(event) => set('maxTokens', event.target.value ? Number(event.target.value) : undefined)}
        />
        <TextField
          label="Timeout (ms)"
          type="number"
          min="1"
          value={draft.timeoutMs?.toString() ?? ''}
          onChange={(event) => set('timeoutMs', event.target.value ? Number(event.target.value) : undefined)}
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => void submit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
