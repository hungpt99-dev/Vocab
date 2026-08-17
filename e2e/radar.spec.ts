import { expect, test } from './fixtures';
import { createServer, type Server } from 'node:http';

/**
 * VOC-161: Radar is generated from saved & enriched vocabulary and highlighted on
 * web pages — NOT discovered by an AI page scan.
 *
 * This spec proves the full loop end-to-end against the built extension:
 *  1. Save + enrich a word  -> Radar candidates are generated (dedicated AI step).
 *  2. A later page containing a Radar candidate is highlighted (.avs-radar-highlight),
 *     with NO AI page-scan call.
 *  3. Saving a Radar word moves it to Saved Vocabulary and the Radar highlight
 *     disappears immediately (vocabulary-changed re-applies highlights).
 *
 * It drives the extension through the page's own chrome.runtime (settings + the
 * save-selection message) rather than the popup UI, which keeps the test stable
 * regardless of popup/headless quirks.
 */
const PORT = 8777;

const EXPLAIN_JSON = JSON.stringify({
  meaning: '[MOCK] meaning of the word',
  simpleExplanation: '[MOCK] simple meaning',
  translation: '[MOCK] bản dịch',
  examples: ['[MOCK] example one.'],
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

// Radar generation returns a candidate the article page contains.
const RADAR_JSON = JSON.stringify({
  candidates: [{ word: 'mitigate', relationship: 'synonym', reason: 'A direct synonym.' }],
});

const ARTICLE_HTML = `<!doctype html><html lang="en"><head><title>Radar Article</title></head>
<body><main>
  <p id="p1">We must mitigate the risk before it grows.</p>
  <p id="p2">The team works to mitigate the impact of the change.</p>
</main></body></html>`;

async function startMockLlm(): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/v1')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let isRadar = false;
        try {
          const parsed = JSON.parse(body) as { messages?: Array<{ role: string; content: string }> };
          const system = parsed.messages?.find((m) => m.role === 'system')?.content ?? '';
          isRadar = system.includes('personal "Radar"');
        } catch {
          isRadar = false;
        }
        console.log('MOCK /v1 hit; isRadar=', isRadar);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ choices: [{ message: { content: isRadar ? RADAR_JSON : EXPLAIN_JSON } }] }));
      });
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(ARTICLE_HTML);
  });
  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', r));
  return server;
}

test('Radar highlights generated candidates on the page and removes them on save', async ({
  context,
  serviceWorker,
}) => {
  test.setTimeout(90_000);
  const server = await startMockLlm();
  const pageUrl = `http://127.0.0.1:${PORT}/`;

  try {
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') console.log('PAGEERR>', m.text());
    });
    await page.goto(pageUrl);
    await page.bringToFront();

    // Seed Radar-enabled settings via the service worker (the page/content script
    // has no direct chrome.storage access; the SW does).
    await serviceWorker.evaluate(
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
          const s = {
            providers: [p],
            activeProviderId: 'local-mock',
            targetLanguage: { code: 'vi-VN', name: 'Vietnamese' },
            readingMode: 'everywhere',
            highlightEnabled: true,
            autoExplainOnSave: true,
            radar: { enabled: true },
          };
          chrome.storage.local.set({ 'avs:settings': s }, () => resolve());
        }),
      [PORT],
    );
    await page.waitForTimeout(400);

    // Save + enrich "risk" by sending the message to the background router from the
    // service worker (the page's main world has no extension APIs). This triggers the
    // dedicated Radar generation step, which adds "mitigate" to the Radar store.
    await serviceWorker.evaluate(() =>
      new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'save-selection', payload: { word: 'risk', sentence: 'We must mitigate the risk.' } },
          () => resolve(),
        );
      }),
    );
    // Allow the explain + Radar generation round-trips to persist.
    await page.waitForTimeout(2500);
    const radarList = await serviceWorker.evaluate(
      () =>
        new Promise<unknown[]>((resolve) => {
          chrome.runtime.sendMessage({ type: 'radar:list' }, (r) => resolve((r as { data: unknown[] })?.data ?? []));
        }),
    );
    console.log('RADAR LIST AFTER SAVE:', JSON.stringify(radarList));
    const hl = await serviceWorker.evaluate(
      () =>
        new Promise<unknown>((resolve) => {
          chrome.runtime.sendMessage({ type: 'get-highlight-data' }, (r) => resolve(r));
        }),
    );
    console.log('HIGHLIGHT DATA AFTER SAVE:', JSON.stringify(hl));

    // The Radar candidate "mitigate" must now be highlighted on the page.
    const radarHighlights = page.locator('mark.avs-radar-highlight');
    await expect(radarHighlights.first()).toBeVisible({ timeout: 15_000 });
    expect(await radarHighlights.count()).toBeGreaterThanOrEqual(1);
    await expect(radarHighlights.first()).toHaveText(/mitigate/i);

    // Not yet a saved highlight — "mitigate" is only a Radar candidate.
    await expect(page.locator('mark.avs-highlight')).toHaveCount(0);

    // Hover the Radar highlight -> Radar card -> Save to Vocabulary.
    await radarHighlights.first().hover();
    const radarCard = page.locator('.avs-radar-card');
    await expect(radarCard).toBeVisible({ timeout: 5_000 });
    await radarCard.getByRole('button', { name: /Save to Vocabulary/i }).click();

    // Immediately after saving, the Radar highlight disappears and the word becomes
    // a proper saved highlight.
    await expect(page.locator('mark.avs-radar-highlight')).toHaveCount(0, { timeout: 10_000 });
    const savedHighlights = page.locator('mark.avs-highlight');
    await expect(savedHighlights.first()).toBeVisible({ timeout: 10_000 });
    await expect(savedHighlights.first()).toHaveText(/mitigate/i);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
