# Vocab — Privacy Policy

Last updated: 2026-08-16

Vocab is a Chrome extension that helps you save, understand, and learn vocabulary
while browsing the web. This policy explains what data the extension handles,
where it goes, and the control you have over it.

## 1. Data We Collect and Store Locally

Vocab stores the following data **locally on your device**, in your browser's
Chrome storage and IndexedDB. None of it is sent to the extension developer.

- **Saved vocabulary**: words/phrases you save, the sentence they appeared in,
  the source page URL and title, notes, tags, favorites, and your AI-generated
  explanations (meaning, translation, examples, synonyms, related words, etc.).
- **Vocab Radar data**: the related terms Vocab generates from your saved words.
- **Settings**: your chosen AI provider(s), model names, target language,
  highlighting preferences, reading mode, and allow-listed domains.
- **AI provider API keys**: if you enter an API key, it is stored locally in
  Chrome storage on your device. It is **never** transmitted to anyone other than
  the AI provider you configure, and never to the extension developer.

## 2. Data Sent to External Services

Vocab only sends data externally when you use a feature that requires it, and only
to services **you** choose:

- **AI explanations / Radar generation**: When you explain a word or generate
  Radar, the word, its context, and your settings are sent to the AI provider you
  have configured (for example OpenAI, Anthropic, Google Gemini, OpenRouter,
  DeepSeek, Mistral, Groq, Together, or a local model you run via Ollama or
  LM Studio). Requests are made directly from your browser to that provider using
  your own API key (or, for a local model, to your local machine with no key).
- **Translation**: When a translation is shown, Vocab can use a keyless Google
  Translate endpoint (`translate.googleapis.com`) that takes the text to translate
  and your target language. No API key is sent for this fallback.
- **Web pages you browse**: Vocab's content script runs on the pages you visit so
  it can highlight your saved vocabulary and let you save selections. It reads page
  text locally to find matches; it does **not** upload the pages you read.

## 3. What We Do NOT Do

- We do **not** operate a backend server that receives your vocabulary, keys, or
  browsing content.
- We do **not** sell, rent, or share your personal data with third parties.
- We do **not** serve advertising.
- We do **not** collect telemetry or analytics about your usage.
- We do **not** require an account.

## 4. Data Retention

All data lives in your browser and persists until you remove it. Uninstalling the
extension removes its locally stored data. Vocab does not retain your data on any
remote server because it has none.

## 5. Your Control Over Your Data

- **View / edit / delete**: Open the Vocab popup to review, edit, or delete any
  saved word, note, or Radar entry.
- **Remove everything**: Clear the extension's storage from `chrome://extensions`
  → Vocab → "Clear data", or uninstall the extension.
- **Stop external requests**: Do not configure an AI provider (or remove its API
  key). Saving and highlighting continue to work; only AI explanations and Radar
  generation require a provider.
- **API keys**: You may delete your API key from Settings at any time. It is stored
  only on your device.

## 6. Children's Privacy

Vocab is not directed to children under 13 and does not knowingly collect personal
data from them.

## 7. Changes to This Policy

If the extension's data handling changes, this policy will be updated and the
"Last updated" date revised.

## 8. Contact

For privacy questions, contact the developer at:

**Product owner contact (to be filled in before submission):**
`[INSERT PRIVACY CONTACT EMAIL / URL]`

> NOTE TO PRODUCT OWNER: Chrome Web Store requires a publicly hosted privacy
> policy URL at submission. Host this file (or its contents) at a stable URL and
> enter it in the store listing. The contact email above must be replaced with a
> real, monitored address before submission.
