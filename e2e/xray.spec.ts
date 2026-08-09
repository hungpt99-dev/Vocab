import { expect, test } from './fixtures';
import { createServer } from 'node:http';

/**
 * VOC-121: X-Ray Reading, verified against a real page in a real Chromium with
 * the BUILT extension loaded.
 *
 * A local OpenAI-compatible mock stands in for the provider: it records the
 * prompt it received (so we can assert the request is language-agnostic) and
 * echoes back an X-Ray JSON payload built from whatever text was sent, so the
 * same test covers English and Vietnamese with no language-specific branch.
 */
const PORT = 8766;

interface Captured {
  system: string;
  user: string;
}

test('X-Ray Reading works on a real page for English and Vietnamese', async ({ context }) => {
  const captured: Captured[] = [];

  const provider = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}') as {
        messages?: Array<{ role: string; content: string }>;
      };
      const system = parsed.messages?.find((m) => m.role === 'system')?.content ?? '';
      const user = parsed.messages?.find((m) => m.role === 'user')?.content ?? '';
      captured.push({ system, user });

      const vietnamese = /[ăâđêôơư]/i.test(user);
      const content = vietnamese
        ? JSON.stringify({
            detectedLanguage: 'Vietnamese',
            meaning: 'Bản báo cáo đã gây ra lo ngại.',
            core: {
              representation: 'Bản báo cáo → gây → lo ngại',
              simpleMeaning: 'Bản báo cáo đã gây ra lo ngại.',
            },
            complexity: [
              { text: 'mà ủy ban công bố hôm qua', explanation: 'Bổ nghĩa cho bản báo cáo.' },
            ],
            relationships: [],
            fullExplanation: 'Ủy ban công bố báo cáo hôm qua, và báo cáo đó gây lo ngại.',
          })
        : JSON.stringify({
            detectedLanguage: 'English',
            meaning: 'The report has caused concern.',
            core: {
              representation: 'The report → has raised → concerns',
              simpleMeaning: 'The report has caused concern.',
            },
            complexity: [
              {
                text: 'that the committee released yesterday',
                explanation: 'Extra information about the report.',
                relatesTo: 'the report',
              },
            ],
            relationships: [{ from: 'the committee', relation: 'released', to: 'the report' }],
            fullExplanation:
              'The committee released a report yesterday, and that report has now caused concern.',
          });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ choices: [{ message: { content } }], model: 'mock-1' }));
    });
  });
  await new Promise<void>((r) => provider.listen(PORT, r));

  // A real page with an English sentence and a Vietnamese sentence.
  const site = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><html lang="en"><head><title>X-Ray sample</title></head><body><main>
       <p><span id="en">The report that the committee released yesterday has raised concerns.</span></p>
       <p><span id="vi">Bản báo cáo mà ủy ban công bố hôm qua đã gây lo ngại.</span></p>
       </main></body></html>`,
    );
  });
  await new Promise<void>((r) => site.listen(0, '127.0.0.1', r));
  const sitePort = (site.address() as { port: number }).port;

  try {
    // Seed the mock provider through an extension page (chrome.storage.local).
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
                  targetLanguage: 'Vietnamese',
                  bilingualMode: false,
                  autoExplainOnSave: false,
                  highlightEnabled: true,
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
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(`http://127.0.0.1:${sitePort}/`);
    await page.bringToFront();
    await page.waitForTimeout(1200);

    const card = page.locator('#avs-selection-card');
    const body = card.locator('.avs-selection-card-body');

    const xrayOn = async (id: string): Promise<void> => {
      await page.locator(`#${id}`).selectText();
      await page.dispatchEvent(`#${id}`, 'mouseup');
      await expect(card).toBeVisible({ timeout: 10_000 });
      await card.locator('[data-action="xray"]').click();
    };

    // --- English ---------------------------------------------------------
    await xrayOn('en');
    await expect(body).toContainText('Core Meaning', { timeout: 20_000 });
    await expect(body).toContainText('The report → has raised → concerns');
    await expect(body).toContainText('What Makes It Complex?');
    await expect(body).toContainText('that the committee released yesterday');
    await expect(body).toContainText('Put It Together');
    await expect(body).toContainText('Detected language: English');

    // --- Vietnamese, via the identical UI path ----------------------------
    await xrayOn('vi');
    await expect(body).toContainText('Bản báo cáo → gây → lo ngại', { timeout: 20_000 });
    await expect(body).toContainText('mà ủy ban công bố hôm qua');
    await expect(body).toContainText('Detected language: Vietnamese');

    // The prompt sent to the provider must never presume a language.
    expect(captured.length).toBeGreaterThanOrEqual(2);
    for (const call of captured) {
      expect(call.system).toContain('ANY language');
      expect(call.system).toContain('Never assume it is English, Vietnamese');
      expect(call.user).toContain('Detect the language of the text yourself');
    }
    expect(pageErrors).toEqual([]);
  } finally {
    provider.close();
    site.close();
  }
});
