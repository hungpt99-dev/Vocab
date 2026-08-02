import type { Explanation } from '@/shared/types/vocabulary';
import { joinUrl, postJson } from '../http';
import { EXPLAIN_WORD_SYSTEM_PROMPT, TRANSLATE_SYSTEM_PROMPT, buildExplainWordUserPrompt, buildTranslateUserPrompt } from '../prompts';
import { toExplanation } from '../parse';
import { AiError, type AiProvider, type ExplainRequest, type ProviderConfig, type TranslateRequest } from '../types';

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

/** Google Gemini generateContent adapter. */
export class GeminiProvider implements AiProvider {
  readonly id = 'gemini' as const;
  readonly label = 'Google Gemini';
  readonly defaultModel = 'gemini-1.5-flash';
  readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  readonly requiresApiKey = true;

  async explain(request: ExplainRequest, config: ProviderConfig): Promise<Explanation> {
    const { content, model } = await this.complete(
      [
        { role: 'system', content: EXPLAIN_WORD_SYSTEM_PROMPT },
        { role: 'user', content: buildExplainWordUserPrompt(request) },
      ],
      config,
      true,
    );
    return toExplanation(content, { provider: this.id, model });
  }

  async translate(request: TranslateRequest, config: ProviderConfig): Promise<string> {
    const { content } = await this.complete(
      [
        { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
        { role: 'user', content: buildTranslateUserPrompt(request) },
      ],
      config,
      false,
    );
    return content;
  }

  /** Run a generateContent call and extract the text plus the model id. */
  private async complete(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    config: ProviderConfig,
    json: boolean,
  ): Promise<{ content: string; model: string }> {
    if (!config.apiKey) {
      throw new AiError('missing_api_key', 'An API key is required for Google Gemini.');
    }

    const model = config.model || this.defaultModel;
    const baseUrl = config.baseUrl || this.defaultBaseUrl;

    const data = await postJson<GeminiResponse>({
      url: joinUrl(baseUrl, `models/${model}:generateContent`),
      headers: { 'x-goog-api-key': config.apiKey },
      signal: config.signal,
      timeoutMs: config.timeoutMs,
      body: {
        systemInstruction: { parts: [{ text: messages[0]?.content }] },
        contents: [{ role: 'user', parts: [{ text: messages[1]?.content }] }],
        generationConfig: {
          temperature: config.temperature ?? 0.2,
          ...(json ? { responseMimeType: 'application/json' } : {}),
          ...(config.maxTokens !== undefined && config.maxTokens !== null
            ? { maxOutputTokens: config.maxTokens }
            : {}),
        },
      },
    });

    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
    if (!content) {
      throw new AiError('bad_response', 'Gemini returned an empty response.');
    }
    return { content, model };
  }
}
