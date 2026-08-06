import { expect, test } from './fixtures';
import { createServer } from 'node:http';

/**
 * VOC-94: popup inline AI-enrich.
 *
 * When a word is highlighted, the popup shows it; clicking "AI enrich" renders
 * the rich explanation INLINE in the popup (no new window); saving the word
 * persists the explanation; the dashboard card has a chevron dropdown to reveal
 * the enrich data.
 *
 * We stand up a local OpenAI-compatible mock so the explain call needs no key
 * and returns deterministic, marker-tagged data we can assert on.
 */
test('popup shows highlighted word, enriches inline, and saves all enrich data', async ({
  context,
  extensionId,
}) => {
  // Local mock that answers explain with marker-tagged JSON.
  const PORT = 8765;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content = JSON.stringify({
        meaning: '[MOCK] meaning of the word',
        simpleExplanation: '[MOCK] simple meaning',
        translation: '[MOCK] bản dịch',
        examples: ['[MOCK] example one.', '[MOCK] example two.'],
        synonyms: ['[MOCK] syn1'],
        antonyms: [],
        relatedWords: [],
        pronunciation: '/mok/',
        collocations: ['[MOCK] collocation'],
        grammar: '[MOCK] noun',
        provider: 'local-mock',
        model: 'mock-1',
        generatedAt: Date.now(),
      });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(PORT, r));

  try {
    const popup = await context.newPage();
    popup.on('console', (m) => { if (m.type() === 'error') console.log('POPUPERR>', m.text()); });
    popup.on('pageerror', (e) => console.log('POPUPPAGEERR>', e.message));
    await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Seed a no-key Ollama (OpenAI-compatible) provider pointing at our local
    // mock. Settings live in chrome.storage.local, not window.localStorage.
    await popup.evaluate(
      ([port]) =>
        new Promise<void>((resolve) => {
          const p = {
            id: 'local-mock',
            name: 'Local Mock',
            type: 'ollama',
            baseUrl: `http://localhost:${port}/v1`,
            apiKey: '',
            model: 'mock-1',
            isBuiltIn: false,
            requiresApiKey: false,
            enabled: true,
          };
          chrome.storage.local.get('avs:settings', (cur) => {
            const existing = (cur['avs:settings'] as Record<string, unknown> | undefined) ?? {};
            const s = {
              ...existing,
              providers: [p],
              activeProviderId: 'local-mock',
              targetLanguage: 'Vietnamese',
              bilingualMode: false,
              autoExplainOnSave: false,
            };
            chrome.storage.local.set({ 'avs:settings': s }, () => resolve());
          });
        }),
      [PORT],
    );
    await popup.reload();
    await popup.waitForTimeout(800);

    // Type the word into the form — the inline enrich panel responds to a typed
    // word just as it does to a page highlight (deterministic, no selection race).
    const wordInput = popup.getByPlaceholder('Select text on the page, or type it here');
    await wordInput.fill('serendipity');

    // The popup should show the word in the enrich panel.
    await expect(popup.getByText('serendipity').first()).toBeVisible();

    // Click "AI enrich" -> explanation renders inline (carrying [MOCK] markers).
    const enrichBtn = popup.getByRole('button', { name: /AI enrich/i });
    await enrichBtn.waitFor({ timeout: 10_000 });
    await enrichBtn.click();
    await expect(popup.getByText('[MOCK] meaning of the word')).toBeVisible({ timeout: 20_000 });

    // Save the word -> it appears in the library with the explanation persisted.
    await popup.getByRole('button', { name: /save to vocabulary/i }).click();
    const saved = popup.getByRole('listitem').filter({ hasText: 'serendipity' });
    await expect(saved).toBeVisible({ timeout: 10_000 });

    // The dashboard card exposes a chevron dropdown to show the enrich data.
    const toggle = saved.getByRole('button', { name: /show enrich data/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(saved.getByText('[MOCK] meaning of the word')).toBeVisible();
  } finally {
    server.close();
  }
});
