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

/**
 * Regression for the "SPA doesn't translate well" report: real SPAs (Next.js,
 * React Router, …) mount the new route ASYNCHRONOUSLY — the new DOM appears a
 * few hundred ms after pushState (data fetch / transition). A single one-shot
 * refresh fires too early, finds no article, and bails, leaving the page
 * untranslated until a manual reload. The fix polls briefly for the new content.
 */
test('bilingual translates an async (delayed-mount) SPA route', async ({ context, extensionId }) => {
  const PORT = 8768;
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
    const html = `<!doctype html><html lang="en"><head><title>Async SPA</title></head>
<body><main>
  <a href="/about" id="go-about">About</a>
  <div id="view-home"><p id="home">Pure serendipity on the home view.</p></div>
  <div id="view-about" hidden></div>
</main>
<script>
  document.getElementById('go-about').addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState({}, '', '/about');
    document.getElementById('view-home').hidden = true;
    // New content is mounted only AFTER a delay, simulating a data fetch.
    setTimeout(() => {
      document.getElementById('view-about').innerHTML =
        '<p id="about">A different concept appears on the about view.</p>';
      document.getElementById('view-about').hidden = false;
    }, 600);
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
    await expect(page.locator('.avs-inline-control').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.avs-inline-translation').first()).toBeVisible({ timeout: 10_000 });

    // In-tab SPA navigation with a DELAYED mount of the new content.
    await page.click('#go-about');
    await expect(page).toHaveURL(/\/about$/);
    // Without polling, the refresh bails at 400ms (content not yet mounted) and
    // the page stays untranslated. With polling, the new content must appear
    // AND be translated.
    await expect(page.locator('main')).toContainText('A different concept appears', { timeout: 10_000 });
    await expect(page.locator('.avs-inline-translation').first()).toBeVisible({ timeout: 10_000 });
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

/**
 * Regression for "khi nav không tự bật translate": translation must AUTO-TURN-ON
 * after an in-tab SPA navigation, even when the previous view had no article and
 * the reader was never open. The earlier handler only refreshed an already-open
 * reader, so navigating from a non-article view to an article view left it
 * untranslated until a manual reload.
 */
test('bilingual auto-turns-on after navigating to an article via SPA', async ({ context, extensionId }) => {
  const PORT = 8769;
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
    const html = `<!doctype html><html lang="en"><head><title>Auto-on SPA</title></head>
<body><main>
  <header>
    <a href="/article" id="go-article">Read article</a>
    <p id="home">This intro view has no body text worth translating.</p>
  </header>
  <div id="view-article" hidden></div>
</main>
<script>
  document.getElementById('go-article').addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState({}, '', '/article');
    document.querySelector('header').style.display = 'none';
    // Synchronous mount of the article (isolates the auto-open behavior; the
    // async-mount case is covered by the delayed-mount test above).
    document.getElementById('view-article').innerHTML =
      '<p id="article">A completely different concept appears here after navigation.</p>';
    document.getElementById('view-article').hidden = false;
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
    // The intro view has no article, so the reader should NOT be open yet.
    await expect(page.locator('.avs-inline-control').first()).toHaveCount(0, { timeout: 5_000 });

    // SPA navigation to the article view must auto-turn-on translation.
    await page.click('#go-article');
    await expect(page).toHaveURL(/\/article$/);
    await expect(page.locator('main')).toContainText('A completely different concept appears', { timeout: 10_000 });
    await expect(page.locator('.avs-inline-control').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.avs-inline-translation').first()).toBeVisible({ timeout: 10_000 });
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

/**
 * Regression for "SPA translation works but the loading skeleton never shows":
 * the skeleton must be visible WHILE the translation is in flight (not just for
 * an imperceptible sub-frame). Uses a mock endpoint that delays ~400ms so the
 * shimmer is observable, then asserts it appears and is later replaced by the
 * real translation.
 */
test('shows the loading skeleton during SPA translation (not just an instant swap)', async ({ context, extensionId }) => {
  const PORT = 8770;
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/v1')) {
      // Delay the response so the skeleton shimmer is actually observable.
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
      setTimeout(() => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ choices: [{ message: { content: body } }] }));
      }, 400);
      return;
    }
    const html = `<!doctype html><html lang="en"><head><title>Skeleton SPA</title></head>
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
    await expect(page.locator('.avs-inline-control').first()).toBeVisible({ timeout: 10_000 });

    // SPA navigation; the new view must show a skeleton shimmer while loading.
    await page.click('#go-about');
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator('.avs-skeleton-line').first()).toBeVisible({ timeout: 2_000 });

    // And eventually the real translation replaces it.
    await expect(page.locator('.avs-inline-translation').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.avs-skeleton-line').first()).toHaveCount(0, { timeout: 10_000 });
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

/**
 * Regression for the double-translation bug (whole page duplicated:
 * Source -> Duplicate -> Translation -> Duplicate -> Quote -> Duplicate).
 *
 * The extension broadcasts `bilingual:reconcile` to every tab on each tab
 * switch. Switching away backgrounds the translated tab (reader.hide() nulls
 * the lazy-load observer but keeps the DOM); switching back re-runs
 * reader.show() -> observeBlocks() -> translateBlocks() again. The reader dedupes
 * already-translated blocks by their block id, so the id MUST be stable across
 * re-extracts. When block ids were random per extractArticle() call, every
 * re-extract produced brand-new ids and the entire translation was injected a
 * SECOND time — duplicating the page. This test switches tabs and asserts the
 * translation count does NOT double.
 */
test('switching tabs does not duplicate the translation', async ({ context, extensionId }) => {
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
    const html = `<!doctype html><html lang="en"><head><title>Tab-switch Dup</title></head>
<body><main>
  <p id="a">First paragraph that gets translated.</p>
  <p id="b">Second paragraph that also gets translated.</p>
  <blockquote id="q">A quoted sentence that is translated too.</blockquote>
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
    await expect(page.locator('.avs-inline-control').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.avs-inline-translation').first()).toBeVisible({ timeout: 10_000 });

    const beforeCount = await page.locator('.avs-inline-translation').count();

    // Switch to a second tab and back — this fires the tab-switch reconcile
    // broadcast that used to re-inject the whole translation.
    const other = await context.newPage();
    await other.goto('about:blank');
    await other.bringToFront();
    await page.bringToFront();
    // Give the reconcile-driven show() + lazy re-translate time to settle.
    await page.waitForTimeout(1500);

    const afterCount = await page.locator('.avs-inline-translation').count();
    // No duplication: the count must be unchanged (not doubled).
    expect(afterCount).toBe(beforeCount);
    // And each original source block must still have exactly one translation line.
    expect(afterCount).toBe(3);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
