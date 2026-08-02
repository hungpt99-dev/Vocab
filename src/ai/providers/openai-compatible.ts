import type { AiProviderId } from '@/shared/types/settings';
import type { Explanation } from '@/shared/types/vocabulary';
import { joinUrl, postJson } from '../http';
import { buildUserPrompt, SYSTEM_PROMPT } from '../prompt';
import { toExplanation } from '../parse';
import { AiError, type AiProvider, type ExplainRequest, type ProviderConfig } from '../types';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
}

export interface OpenAiCompatiblePreset {
  id: AiProviderId;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
  /** Extra headers some gateways require (e.g. OpenRouter attribution). */
  extraHeaders?: Record<string, string>;
}

/**
 * A single adapter covering every provider that speaks the OpenAI
 * chat-completions dialect: OpenAI, OpenRouter, LM Studio and Ollama.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  constructor(private readonly preset: OpenAiCompatiblePreset) {}

  get id(): AiProviderId {
    return this.preset.id;
  }
  get label(): string {
    return this.preset.label;
  }
  get defaultModel(): string {
    return this.preset.defaultModel;
  }
  get defaultBaseUrl(): string {
    return this.preset.defaultBaseUrl;
  }
  get requiresApiKey(): boolean {
    return this.preset.requiresApiKey;
  }

  async explain(request: ExplainRequest, config: ProviderConfig): Promise<Explanation> {
    if (this.requiresApiKey && !config.apiKey) {
      throw new AiError('missing_api_key', `An API key is required for ${this.label}.`);
    }

    const model = config.model || this.defaultModel;
    const baseUrl = config.baseUrl || this.defaultBaseUrl;
    const headers: Record<string, string> = { ...this.preset.extraHeaders };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

    const data = await postJson<ChatCompletionResponse>({
      url: joinUrl(baseUrl, 'chat/completions'),
      headers,
      signal: config.signal,
      timeoutMs: config.timeoutMs,
      body: {
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(request) },
        ],
      },
    });

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiError('bad_response', `${this.label} returned an empty response.`);
    }
    return toExplanation(content, { provider: this.id, model: data.model ?? model });
  }
}

export const OPENAI_COMPATIBLE_PRESETS: OpenAiCompatiblePreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'openai/gpt-4o-mini',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    extraHeaders: { 'X-Title': 'AI Vocabulary Saver' },
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    defaultModel: 'local-model',
    defaultBaseUrl: 'http://localhost:1234/v1',
    requiresApiKey: false,
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    defaultModel: 'llama3.1',
    defaultBaseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
  },
];
