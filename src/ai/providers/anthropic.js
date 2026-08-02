import { joinUrl, postJson } from '../http';
import { buildUserPrompt, SYSTEM_PROMPT } from '../prompt';
import { toExplanation } from '../parse';
import { AiError } from '../types';
/** Anthropic Messages API adapter. */
export class AnthropicProvider {
    id = 'anthropic';
    label = 'Anthropic Claude';
    defaultModel = 'claude-3-5-haiku-latest';
    defaultBaseUrl = 'https://api.anthropic.com/v1';
    requiresApiKey = true;
    async explain(request, config) {
        if (!config.apiKey) {
            throw new AiError('missing_api_key', 'An API key is required for Anthropic.');
        }
        const model = config.model || this.defaultModel;
        const baseUrl = config.baseUrl || this.defaultBaseUrl;
        const data = await postJson({
            url: joinUrl(baseUrl, 'messages'),
            headers: {
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
                // Required for browser-originated calls to the Anthropic API.
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            signal: config.signal,
            timeoutMs: config.timeoutMs,
            body: {
                model,
                max_tokens: 1024,
                temperature: 0.2,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: buildUserPrompt(request) }],
            },
        });
        const content = data.content
            ?.filter((block) => block.type === 'text' || block.text)
            .map((block) => block.text ?? '')
            .join('');
        if (!content) {
            throw new AiError('bad_response', 'Anthropic returned an empty response.');
        }
        return toExplanation(content, { provider: this.id, model: data.model ?? model });
    }
}
