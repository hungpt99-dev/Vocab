import type { AiProviderId } from '@/shared/types/settings';
import type { Explanation } from '@/shared/types/vocabulary';
import { joinUrl, postJson } from '../http';
import {
  TRANSLATE_SYSTEM_PROMPT,
  buildExplainSystemPrompt,
  buildExplainWordUserPrompt,
  buildTranslateUserPrompt,
} from '../prompts';
import { toExplanation } from '../parse';
import { parseTranslations } from '../parse-translation';
import type { TranslateResult } from '../types';
import { AiError, type AiProvider, type ExplainRequest, type ProviderConfig, type TranslateRequest } from '../types';

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
    const { content, model } = await this.complete(
      config,
      buildExplainSystemPrompt(request.kind, request.promptTemplate),
      buildExplainWordUserPrompt(request),
    );
    return toExplanation(content, { provider: this.id, model });
  }

  async translate(request: TranslateRequest, config: ProviderConfig): Promise<TranslateResult> {
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
        messages: [
          { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
          { role: 'user', content: buildTranslateUserPrompt(request) },
        ],
        temperature: config.temperature ?? 0.1,
        ...(config.maxTokens !== undefined && config.maxTokens !== null
          ? { max_tokens: config.maxTokens }
          : { max_tokens: 4096 }),
      },
    });

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiError('bad_response', `${this.label} returned an empty response.`);
    }
    const translations = parseTranslations(content, request.paragraphs.length);
    return {
      paragraphs: request.paragraphs.map((paragraph, index) => ({
        text: paragraph.text,
        translation: translations[index] ?? '',
      })),
    };
  }

  /** Post one chat-completions call with a system + user turn and extract the text. */
  private async complete(
    config: ProviderConfig,
    system: string,
    user: string,
  ): Promise<{ content: string; model: string }> {
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
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: config.temperature ?? 0.2,
        ...(config.maxTokens !== undefined && config.maxTokens !== null
          ? { max_tokens: config.maxTokens }
          : {}),
      },
    });

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiError('bad_response', `${this.label} returned an empty response.`);
    }
    return { content, model: data.model ?? model };
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
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
  },
  {
    id: 'mistral',
    label: 'Mistral',
    defaultModel: 'mistral-small-latest',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    requiresApiKey: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
  },
  {
    id: 'together',
    label: 'Together AI',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    requiresApiKey: true,
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
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    defaultModel: '',
    defaultBaseUrl: '',
    requiresApiKey: false,
  },
];
