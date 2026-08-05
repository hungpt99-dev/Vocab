import { chromium } from '@playwright/test';
import { createServer } from 'node:http';

const EXT = new URL('../dist', import.meta.url).pathname;
const TARGET_PAGE = process.env.TARGET_URL || 'https://docs.nestjs.com';
const TARGET_LANG = process.env.TARGET_LANG || 'Vietnamese';

const SEED = `(() => {
  const s = {
    providers: [{ id: 'prov_default', type: 'openai', name: 'OpenAI', apiKey: ${JSON.stringify(process.env.API_KEY ?? '')}, baseUrl: '', model: '', enabled: true }],
    activeProviderId: 'prov_default',
    targetLanguage: ${JSON.stringify(TARGET_LANG)},
    highlightEnabled: true,
    highlightColor: '#ffd400',
    autoExplainOnSave: false,
    bilingualMode: true,
    explainPromptTemplate: '',
    readingExperience: { showOriginal: true, showTranslation: true, width: 'normal', fontSize: 'normal', spacing: 'normal' },
  };
  chrome.storage.local.set({ 'avs:settings': s });
})();`;

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});

const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const extId = new URL(sw.url()).host;
sw.on('console', (m) => { if (m.text().includes('[fb]')) console.log('SW>', m.text()); });
sw.on('pageerror', (e) => console.log('SWERR>', e.message));

let gtxCount = 0, gtxOk = 0, gtxFail = 0;
ctx.on('request', (r) => { if (r.url().includes('translate.googleapis.com')) gtxCount++; });
ctx.on('response', (r) => { if (r.url().includes('translate.googleapis.com')) { gtxOk++; } });
ctx.on('requestfailed', (r) => { if (r.url().includes('translate.googleapis.com')) gtxFail++; });
const consoleErrors = [];
ctx.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

// Seed settings via popup.
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/src/popup/index.html`);
await popup.waitForTimeout(600);
await popup.evaluate(SEED);
await popup.waitForTimeout(400);
await popup.close();

const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));

await page.goto(TARGET_PAGE, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => errors.push('GOTO: ' + e.message));
await page.waitForTimeout(15000);

const out = await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.avs-inline-translation')].map((e) => e.textContent);
  const glosses = [...document.querySelectorAll('.avs-gloss-word')].slice(0, 8).map((e) => ({ src: e.textContent, tgt: e.dataset.avsGloss }));
  const bar = !!document.querySelector('.avs-bilingual-bar, [class*="bilingual-bar"]');
  const hasArticle = !!document.querySelector('article, main, [class*="content"], p');
  return { lineCount: lines.length, glossCount: document.querySelectorAll('.avs-gloss-word').length, bar, hasArticle, sampleLines: lines.slice(0, 4), sampleGlosses: glosses };
});

console.log('=== SELFTEST RESULT ===');
console.log(JSON.stringify({ gtxCount, gtxOk, gtxFail, target: TARGET_LANG, page: TARGET_PAGE, ...out, pageErrors: errors.slice(0, 10) }, null, 1));

await ctx.close();
