import type { Explanation } from '@/shared/types/vocabulary';
import { joinUrl, postJson } from '../http';
import { buildExplainSystemPrompt, buildExplainUserPrompt } from '../prompts';
import { toExplanation } from '../parse';
import { AiError, type AiProvider, type ExplainRequest, type ProviderConfig } from '../types';

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  model?: string;
}

/** Anthropic Messages API adapter. */
export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic' as const;
  readonly label = 'Anthropic Claude';
  readonly defaultModel = 'claude-3-5-haiku-latest';
  readonly defaultBaseUrl = 'https://api.anthropic.com/v1';
  readonly requiresApiKey = true;

  async explain(request: ExplainRequest, config: ProviderConfig): Promise<Explanation> {
    if (!config.apiKey) {
      throw new AiError('missing_api_key', 'An API key is required for Anthropic.');
    }

    const model = config.model || this.defaultModel;
    const baseUrl = config.baseUrl || this.defaultBaseUrl;

    const data = await postJson<AnthropicResponse>({
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
        max_tokens: config.maxTokens ?? 1024,
        temperature: config.temperature ?? 0.2,
        system: buildExplainSystemPrompt(request.unit),
        messages: [{ role: 'user', content: buildExplainUserPrompt(request) }],
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
