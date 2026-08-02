import { joinUrl, postJson } from '../http';
import { buildUserPrompt, SYSTEM_PROMPT } from '../prompt';
import { toExplanation } from '../parse';
import { AiError } from '../types';
/**
 * A single adapter covering every provider that speaks the OpenAI
 * chat-completions dialect: OpenAI, OpenRouter, LM Studio and Ollama.
 */
export class OpenAiCompatibleProvider {
    preset;
    constructor(preset) {
        this.preset = preset;
    }
    get id() {
        return this.preset.id;
    }
    get label() {
        return this.preset.label;
    }
    get defaultModel() {
        return this.preset.defaultModel;
    }
    get defaultBaseUrl() {
        return this.preset.defaultBaseUrl;
    }
    get requiresApiKey() {
        return this.preset.requiresApiKey;
    }
    async explain(request, config) {
        if (this.requiresApiKey && !config.apiKey) {
            throw new AiError('missing_api_key', `An API key is required for ${this.label}.`);
        }
        const model = config.model || this.defaultModel;
        const baseUrl = config.baseUrl || this.defaultBaseUrl;
        const headers = { ...this.preset.extraHeaders };
        if (config.apiKey)
            headers.Authorization = `Bearer ${config.apiKey}`;
        const data = await postJson({
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
export const OPENAI_COMPATIBLE_PRESETS = [
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
