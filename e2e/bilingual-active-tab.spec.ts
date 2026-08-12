import { expect, test } from './fixtures';
import { createServer } from 'node:http';

/**
 * Regression: enabling global Bilingual mode must translate ONLY the active
 * tab, not every open tab. (The bug: content scripts run per-tab on <all_urls>,
 * so a global setting previously turned the inline reader on in all tabs at
 * once.) This test opens two article tabs, switches Bilingual on, and verifies
 * the background tab stays untranslated while the focused tab does.
 */
test('bilingual mode translates only the active tab, not all open tabs', async ({
  context,
  extensionId,
  samplePageUrl,
}) => {
  const PORT = 8766;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content = JSON.stringify({
        meaning: '[MOCK] meaning',
        simpleExplanation: '[MOCK] simple',
        translation: '[MOCK] bản dịch',
        examples: ['[MOCK] example.'],
        synonyms: [],
        antonyms: [],
        relatedWords: [],
        pronunciation: '/mok/',
        collocations: [],
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
    await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

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
              bilingualMode: true,
              autoExplainOnSave: false,
            };
            chrome.storage.local.set({ 'avs:settings': s }, () => resolve());
          });
        }),
      [PORT],
    );
    await popup.reload();
    await popup.waitForTimeout(600);
    await popup.close();

    // Tab A — opened and brought to front (the active tab).
    const tabA = await context.newPage();
    await tabA.goto(samplePageUrl);
    await tabA.bringToFront();
    await tabA.waitForTimeout(1200);

    // Tab B — opened but intentionally left in the background (never focused).
    const tabB = await context.newPage();
    await tabB.goto(samplePageUrl);
    // Keep A active so B is genuinely backgrounded.
    await tabA.bringToFront();
    await tabB.waitForTimeout(1500);

    // Active tab should have injected the bilingual control / translations.
    await expect(tabA.locator('.avs-inline-control').first()).toBeVisible({ timeout: 10_000 });

    // Background tab must NOT have translated: no inline control, no gloss nodes.
    await expect(tabB.locator('.avs-inline-control').first()).toHaveCount(0);
    await expect(tabB.locator('.avs-gloss-word').first()).toHaveCount(0);
    await expect(tabB.locator('.avs-inline-translation').first()).toHaveCount(0);

    // Now focus the background tab: it should translate on focus (one tab at a time).
    await tabB.bringToFront();
    await tabB.waitForTimeout(1500);
    await expect(tabB.locator('.avs-inline-control').first()).toBeVisible({ timeout: 10_000 });
  } finally {
    server.close();
  }
});
