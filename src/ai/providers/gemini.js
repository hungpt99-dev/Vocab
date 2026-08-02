import { joinUrl, postJson } from '../http';
import { buildUserPrompt, SYSTEM_PROMPT } from '../prompt';
import { toExplanation } from '../parse';
import { AiError } from '../types';
/** Google Gemini generateContent adapter. */
export class GeminiProvider {
    id = 'gemini';
    label = 'Google Gemini';
    defaultModel = 'gemini-1.5-flash';
    defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    requiresApiKey = true;
    async explain(request, config) {
        if (!config.apiKey) {
            throw new AiError('missing_api_key', 'An API key is required for Google Gemini.');
        }
        const model = config.model || this.defaultModel;
        const baseUrl = config.baseUrl || this.defaultBaseUrl;
        const data = await postJson({
            url: joinUrl(baseUrl, `models/${model}:generateContent`),
            headers: { 'x-goog-api-key': config.apiKey },
            signal: config.signal,
            timeoutMs: config.timeoutMs,
            body: {
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: 'user', parts: [{ text: buildUserPrompt(request) }] }],
                generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
            },
        });
        const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
        if (!content) {
            throw new AiError('bad_response', 'Gemini returned an empty response.');
        }
        return toExplanation(content, { provider: this.id, model });
    }
}
