import { chromium } from '@playwright/test';

// Prove the silent-failure case is gone: when the keyless endpoint is
// unreachable (network/firewall/region block), the extension must show a
// PERSISTENT banner explaining why — NOT a silently empty page.
const EXT = new URL('../dist', import.meta.url).pathname;
const TARGET_PAGE = 'https://docs.nestjs.com';
const SEED = `(() => {
  const s = {
    providers: [{ id: 'prov_default', type: 'openai', name: 'OpenAI', apiKey: '', baseUrl: '', model: '', enabled: true }],
    activeProviderId: 'prov_default',
    targetLanguage: 'Vietnamese',
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

// Block the keyless endpoint so the fallback cannot reach the network.
await ctx.route('**/*translate.googleapis.com**', (route) => route.abort());

const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/src/popup/index.html`);
await popup.waitForTimeout(600); await popup.evaluate(SEED); await popup.waitForTimeout(400); await popup.close();

const page = await ctx.newPage();
await page.goto(TARGET_PAGE, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(8000);

const out = await page.evaluate(() => {
  const banner = document.querySelector('.avs-bilingual-banner');
  return {
    bannerPresent: !!banner,
    bannerText: banner ? banner.textContent : null,
    translationLines: document.querySelectorAll('.avs-inline-translation').length,
  };
});
console.log('=== BLOCKED-NETWORK SELFTEST ===');
console.log(JSON.stringify(out, null, 1));
await ctx.close();
