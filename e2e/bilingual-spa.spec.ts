import { expect, test } from './fixtures';
import { createServer } from 'node:http';

/**
 * Regression: clicking a client-side (SPA) link that swaps the page via
 * history.pushState — with NO full reload — must still translate the new content.
 * Previously the content script only translated on full navigation / tab switch,
 * so in-tab SPA routes opened untranslated even with Bilingual mode on.
 */
test('bilingual translates a new page after an in-tab SPA (pushState) navigation', async ({
  context,
  extensionId,
}) => {
  const PORT = 8767;
  // One server serves both the fixture page and the mock LLM endpoint, so the
  // test owns its own teardown (no shared-fixture server that can hang on close).
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
    const html = `<!doctype html><html lang="en"><head><title>SPA</title></head>
<body><main>
  <a href="/about" id="go-about">About</a>
  <div id="view-home"><p id="home">Pure serendipity on the home view.</p></div>
  <div id="view-about" hidden><p id="about">A different concept appears on the about view.</p></div>
</main>
<script>
  document.getElementById('go-about').addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState({}, '', '/about');
    document.getElementById('view-home').hidden = true;
    document.getElementById('view-about').hidden = false;
  });
  window.addEventListener('popstate', () => {});
</script></body></html>`;
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
              // NOTE: language is set as a bare string here only to exercise the
              // settings migration path; the refactor makes this a Language object.
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

    const page = await context.newPage();
    await page.goto(pageUrl);
    await page.bringToFront();
    // Bilingual is active and the first view is translated.
    await expect(page.locator('.avs-inline-control').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.avs-inline-translation').first()).toBeVisible({ timeout: 10_000 });

    // In-tab SPA navigation (pushState, no reload).
    await page.click('#go-about');
    await expect(page).toHaveURL(/\/about$/);
    // The new view's content is now on the page AND translated — this is the
    // regression: a client-side route swap must re-trigger translation.
    await expect(page.locator('main')).toContainText('A different concept appears', { timeout: 10_000 });
    await expect(page.locator('.avs-inline-translation').first()).toBeVisible({ timeout: 10_000 });
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
