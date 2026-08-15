import { chromium } from '@playwright/test';

// Verify VOC-92: turning bilingual OFF via the in-page bar on ONE tab must NOT
// turn it off on other open tabs (the bug wrote the global setting flag).
const EXT = new URL('../dist', import.meta.url).pathname;
const SEED = `(() => {
  const s = {
    providers: [{ id: 'prov_default', type: 'openai', name: 'OpenAI', apiKey: '', baseUrl: '', model: '', enabled: true }],
    activeProviderId: 'prov_default',
    targetLanguage: { code: 'vi-VN', name: 'Vietnamese' },
    highlightEnabled: true, highlightColor: '#ffd400', autoExplainOnSave: false,
    bilingualMode: true, explainPromptTemplate: '',
    readingExperience: { showOriginal: true, showTranslation: true, width: 'normal', fontSize: 'normal', spacing: 'normal' },
  };
  chrome.storage.local.set({ 'avs:settings': s });
})();`;

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox', '--disable-dev-shm-usage'],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const extId = new URL(sw.url()).host;

const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/src/popup/index.html`);
await popup.waitForTimeout(600); await popup.evaluate(SEED); await popup.waitForTimeout(400); await popup.close();

// Tab A and Tab B both on the target page.
const tabA = await ctx.newPage();
const tabB = await ctx.newPage();
for (const p of [tabA, tabB]) {
  await p.goto('https://docs.nestjs.com/controllers', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
}
await tabA.waitForTimeout(6000);
await tabB.waitForTimeout(6000);

const stateBefore = await tabB.evaluate(() => ({
  on: document.body.classList.contains('avs-bilingual-on'),
  lines: document.querySelectorAll('.avs-inline-translation').length,
}));

// Turn OFF on Tab A via the reader control's close button.
await tabA.evaluate(() => {
  const btn = document.querySelector('.avs-inline-control [aria-label="Close bilingual reading"]');
  if (btn) btn.click();
});
await tabA.waitForTimeout(1500);

const tabAState = await tabA.evaluate(() => ({
  on: document.body.classList.contains('avs-bilingual-on'),
}));
const tabBState = await tabB.evaluate(() => ({
  on: document.body.classList.contains('avs-bilingual-on'),
  lines: document.querySelectorAll('.avs-inline-translation').length,
}));

console.log('=== CROSS-TAB SELFTEST ===');
console.log(JSON.stringify({ stateBefore, tabAState, tabBState }, null, 1));
console.log(tabAState.on === false && tabBState.on === true && tabBState.lines > 0
  ? 'PASS: tab A off, tab B still on'
  : 'FAIL: per-tab state leaked');
await ctx.close();
