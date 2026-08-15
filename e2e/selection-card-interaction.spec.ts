import { expect, test } from './fixtures';
import { createServer } from 'node:http';

/**
 * VOC-123: the floating selection card must survive being clicked.
 *
 * Clicking any control inside the card collapses the page selection, which
 * fires `selectionchange` with an empty selection. That used to hide the card
 * immediately, so the popup vanished the moment the user tried to use it.
 *
 * This drives the BUILT extension in a real browser and interacts with the card
 * the way a user does: click a control, then click another one.
 */
const PORT = 8767;

test('the selection card stays open while the user interacts with it', async ({ context }) => {
  const provider = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content = JSON.stringify({
        detectedLanguage: 'English',
        meaning: 'The report has caused concern.',
        core: {
          representation: 'The report → has raised → concerns',
          simpleMeaning: 'The report has caused concern.',
        },
        complexity: [],
        relationships: [],
        fullExplanation: 'The committee published a report and it worries people.',
        structure: 'One main clause with a relative clause on the subject.',
        grammar: 'Relative clause plus present perfect.',
        why: 'Fronting the report makes it the topic.',
        vocabulary: [{ term: 'raise concerns', note: 'to cause worry', kind: 'collocation' }],
        difficulty: { cefr: 'B2', reason: 'Embedded clause.' },
        simplerVersion: 'The committee published a report. People are worried.',
      });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ choices: [{ message: { content } }], model: 'mock-1' }));
    });
  });
  await new Promise<void>((r) => provider.listen(PORT, r));

  const site = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><html><head><title>card</title></head><body><main>
       <p><span id="s">The report that the committee released yesterday has raised concerns.</span></p>
       <p><span id="other">Some other unrelated paragraph of text on the page.</span></p>
       </main></body></html>`,
    );
  });
  await new Promise<void>((r) => site.listen(0, '127.0.0.1', r));
  const sitePort = (site.address() as { port: number }).port;

  try {
    const seed = await context.newPage();
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(sw.url()).host;
    await seed.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await seed.evaluate(
      ([port]) =>
        new Promise<void>((resolve) => {
          chrome.storage.local.get('avs:settings', (cur) => {
            const existing = (cur['avs:settings'] as Record<string, unknown> | undefined) ?? {};
            chrome.storage.local.set(
              {
                'avs:settings': {
                  ...existing,
                  providers: [
                    {
                      id: 'local-mock',
                      name: 'Local Mock',
                      type: 'ollama',
                      baseUrl: `http://localhost:${port}/v1`,
                      apiKey: '',
                      model: 'mock-1',
                      isBuiltIn: false,
                      requiresApiKey: false,
                      enabled: true,
                    },
                  ],
                  activeProviderId: 'local-mock',
                  targetLanguage: { code: 'vi-VN', name: 'Vietnamese' },
                  bilingualMode: false,
                  autoExplainOnSave: false,
                },
              },
              () => resolve(),
            );
          });
        }),
      [PORT],
    );
    await seed.close();

    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${sitePort}/`);
    await page.bringToFront();
    await page.waitForTimeout(1000);

    const card = page.locator('#avs-selection-card');

    await page.locator('#s').selectText();
    await page.dispatchEvent('#s', 'mouseup');
    await expect(card).toBeVisible({ timeout: 10_000 });

    // 1. A real mouse click on a card control must not dismiss the card.
    await card.locator('[data-action="xray"]').click();
    await expect(card).toBeVisible();

    // 2. The result arrives and the card is STILL there to show it.
    const body = card.locator('.avs-selection-card-body');
    await expect(body).toContainText('Core Meaning', { timeout: 20_000 });
    await expect(card).toBeVisible();

    // 3. The user can keep interacting: expand a section, card stays open.
    const section = card.locator('.avs-xray-section', { hasText: 'Structure' }).first();
    await section.evaluate((el) => {
      const scroller = el.closest('.avs-selection-card-body') as HTMLElement | null;
      if (scroller) scroller.scrollTop = (el as HTMLElement).offsetTop - scroller.offsetTop;
    });
    await section.locator('.avs-xray-summary').click();
    await expect(card).toBeVisible();
    await expect(section).toContainText('relative clause');

    // 4. A second, different control still responds — the card is alive and
    //    interactive, not a one-shot panel. Collapsing the section again proves
    //    repeated interaction works.
    await section.locator('.avs-xray-summary').click();
    await expect(section).toHaveJSProperty('open', false);
    await expect(card).toBeVisible();

    // 5. Actions that deliberately close the card still do so. `copy` ends the
    //    interaction by design, so the card must hide after it.
    await card.locator('[data-action="copy"]').click();
    await expect(card).toBeHidden({ timeout: 5_000 });

    // 6. And a plain outside click still dismisses a freshly opened card.
    //    Click far from the card so the card itself cannot intercept it.
    await page.locator('#s').selectText();
    await page.dispatchEvent('#s', 'mouseup');
    await expect(card).toBeVisible({ timeout: 10_000 });
    const box = await card.boundingBox();
    await page.mouse.click(10, Math.round((box ? box.y + box.height : 400) + 120));
    await expect(card).toBeHidden({ timeout: 5_000 });
  } finally {
    provider.close();
    site.close();
  }
});
