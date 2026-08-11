import type { Explanation } from '@/shared/types/vocabulary';
import { joinUrl, postJson } from '../http';
import {
  TRANSLATE_SYSTEM_PROMPT,
  ALIGN_SYSTEM_PROMPT,
  buildExplainSystemPrompt,
  buildExplainWordUserPrompt,
  buildTranslateUserPrompt,
  buildAlignUserPrompt,
} from '../prompts';
import { toExplanation } from '../parse';
import { parseTranslations, parseWordAlignments } from '../parse-translation';
import type { TranslateResult, WordAlignResult } from '../types';
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
    const content = await this.complete(
      buildExplainSystemPrompt(request.kind, request.promptTemplate),
      buildExplainWordUserPrompt(request),
      config,
      'application/json',
    );
    return toExplanation(content, {
      provider: this.id,
      model: config.model || this.defaultModel,
      kind: request.kind,
      text: request.word,
    });
  }

  async translate(request: TranslateRequest, config: ProviderConfig): Promise<TranslateResult> {
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
        systemInstruction: { parts: [{ text: TRANSLATE_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildTranslateUserPrompt(request) }] }],
        generationConfig: {
          temperature: config.temperature ?? 0.1,
          ...(config.maxTokens !== undefined && config.maxTokens !== null
            ? { maxOutputTokens: config.maxTokens }
            : {}),
          responseMimeType: 'application/json',
        },
      },
    });

    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
    if (!content) {
      throw new AiError('bad_response', 'Gemini returned an empty response.');
    }
    const translations = parseTranslations(content, request.paragraphs.length);
    return {
      paragraphs: request.paragraphs.map((paragraph, index) => ({
        text: paragraph.text,
        translation: translations[index] ?? '',
      })),
    };
  }

  async align(request: TranslateRequest, config: ProviderConfig): Promise<WordAlignResult[]> {
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
        systemInstruction: { parts: [{ text: ALIGN_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildAlignUserPrompt(request) }] }],
        generationConfig: {
          temperature: config.temperature ?? 0.1,
          ...(config.maxTokens !== undefined && config.maxTokens !== null
            ? { maxOutputTokens: config.maxTokens }
            : {}),
          responseMimeType: 'application/json',
        },
      },
    });

    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
    if (!content) {
      throw new AiError('bad_response', 'Gemini returned an empty response.');
    }
    const all = parseWordAlignments(content, request.paragraphs.length);
    return request.paragraphs.map((paragraph, index) => {
      const aligned = all[index] ?? { translation: '', pairs: [] };
      return {
        id: paragraph.id ?? '',
        text: paragraph.text,
        pairs: aligned.pairs,
        translation: aligned.translation,
      };
    });
  }

  /** Post one generateContent call with a system instruction and read the text. */
  async complete(
    system: string,
    user: string,
    config: ProviderConfig,
    responseMimeType?: string,
  ): Promise<string> {
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
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: config.temperature ?? 0.2,
          ...(config.maxTokens !== undefined && config.maxTokens !== null
            ? { maxOutputTokens: config.maxTokens }
            : {}),
          responseMimeType,
        },
      },
    });

    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
    if (!content) {
      throw new AiError('bad_response', 'Gemini returned an empty response.');
    }
    return content;
  }
}
