import { expect, test } from './fixtures';
import { createServer } from 'node:http';

/**
 * Regression for "after save word, page auto reloads and re-translates bilingual mode".
 * Saving a word broadcasts `vocabulary-changed`. The content script used to run the
 * full refresh() on that message, which re-synced the Bilingual reader and re-translated
 * the entire page (visible flash / auto-reload look). `vocabulary-changed` must only
 * refresh word highlights + Radar, never re-translate an already-translated page.
 */
test('saving a word (vocabulary-changed) does NOT re-translate the page', async ({
  context,
  extensionId,
}) => {
  const PORT = 8791;
  // Self-contained server: fixture page + mock LLM endpoint.
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
    const html = `<!doctype html><html lang="en"><head><title>SaveWord</title></head>
<body><main>
  <p id="a">Pure serendipity greets the morning light.</p>
  <p id="b">A quiet hypothesis hums beneath the data.</p>
  <p id="c">Sustainable procurement remains a global priority.</p>
</main></body></html>`;
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
              readingMode: 'everywhere',
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

    // Page is translated.
    await expect(page.locator('.avs-inline-control').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.avs-inline-translation').first()).toBeVisible({ timeout: 10_000 });
    const before = await page.locator('.avs-inline-translation').count();
    expect(before).toBe(3);

    // Arm a page-side observer: ANY re-translation shows a skeleton shimmer
    // (the reader injects one up-front before painting the result), so a
    // skeleton appearing proves a re-translate happened. This catches the bug
    // even though the translation COUNT is unchanged (block IDs are de-duped).
    await page.evaluate(() => {
      (window as unknown as { __sawSkeleton: boolean }).__sawSkeleton = false;
      const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node instanceof HTMLElement && node.classList.contains('avs-skeleton-line')) {
              (window as unknown as { __sawSkeleton: boolean }).__sawSkeleton = true;
            }
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    });

    // Simulate the message a word-save broadcasts to every tab.
    const triggerPopup = await context.newPage();
    await triggerPopup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await triggerPopup.waitForTimeout(300);
    await triggerPopup.evaluate(
      (articleUrl) =>
        new Promise<void>((resolve) => {
          chrome.tabs.query({}, (tabs) => {
            const tab = tabs.find((t) => t.url === articleUrl);
            if (!tab?.id) {
              resolve();
              return;
            }
            chrome.tabs.sendMessage(tab.id, { type: 'vocabulary-changed' }, () => resolve());
          });
        }),
      pageUrl,
    );

    // Give a re-translate time to misbehave, if it still existed.
    await page.waitForTimeout(1500);

    const sawSkeleton = await page.evaluate(
      () => (window as unknown as { __sawSkeleton: boolean }).__sawSkeleton,
    );
    expect(sawSkeleton).toBe(false);

    // The translation count must be unchanged — no re-translation / auto-reload.
    const after = await page.locator('.avs-inline-translation').count();
    expect(after).toBe(before);

    await triggerPopup.close();
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
