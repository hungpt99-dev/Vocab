import { expect, test } from './fixtures';
import { createServer } from 'node:http';

/**
 * Regression for "button refresh does not translate when Bilingual mode is on
 * but the page is not yet translated": with readingMode 'allowed' and the
 * current site NOT in allowedDomains, clicking the popup Refresh button must
 * still translate the page (Refresh is an explicit user intent to translate the
 * current page, independent of the allowed-list scope). Previously the Refresh
 * handler called reader.refresh() -> open(), and open() only translated when
 * isReadingActiveOnHost() was true (allowed + on-list), so an off-list site in
 * 'allowed' mode got a control but never any translation.
 */
test('refresh button translates even in allowed-mode when the site is not yet on the list', async ({
  context,
  extensionId,
}) => {
  const PORT = 8771;
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/v1')) {
      const body = JSON.stringify({
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
      res.end(JSON.stringify({ choices: [{ message: { content: body } }] }));
      return;
    }
    const html = `<!doctype html><html lang="en"><head><title>Refresh</title></head>
<body><main><p id="article">The procurement of sustainable energy remains a global priority.</p></main></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  });
  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', r));
  const pageUrl = `http://127.0.0.1:${PORT}/`;

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
              targetLanguage: { code: 'vi-VN', name: 'Vietnamese' },
              // 'allowed' mode, but the test site is NOT in allowedDomains.
              readingMode: 'allowed',
              allowedDomains: ['some-other-site.example'],
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

    const page = await context.newPage();
    await page.goto(pageUrl);
    await page.bringToFront();

    // Bilingual is "on" (allowed mode) but this site is off-list, so the page
    // should NOT be auto-translated yet.
    await expect(page.locator('.avs-inline-control').first()).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('.avs-inline-translation').first()).toHaveCount(0, { timeout: 5_000 });

    // Open the popup context, then drive Refresh the same way the popup button
    // does — send `bilingual:refresh` (force) to the active article tab's content
    // script. (In a real browser the popup is a separate window so its
    // `currentHost` resolves the page; here the popup is a Playwright tab, so we
    // send the message directly to the article tab to exercise the content path.)
    const refreshPopup = await context.newPage();
    await refreshPopup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await refreshPopup.waitForTimeout(400);
    await refreshPopup.evaluate(
      (articleUrl) =>
        new Promise<void>((resolve) => {
          chrome.tabs.query({}, (tabs) => {
            const tab = tabs.find((t) => t.url === articleUrl);
            if (!tab?.id) {
              resolve();
              return;
            }
            chrome.tabs.sendMessage(tab.id, { type: 'bilingual:refresh', force: true }, () => resolve());
          });
        }),
      pageUrl,
    );

    // The page must now be translated even though it was off-list.
    await expect(page.locator('.avs-inline-control').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.avs-inline-translation').first()).toBeVisible({ timeout: 10_000 });
    // The translation is rendered (Vietnamese text injected by the reader).
    await expect(page.locator('.avs-inline-translation').first()).not.toHaveText('', { timeout: 10_000 });

    await refreshPopup.close();
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
