import { chromium } from '@playwright/test';

const EXT = new URL('./dist', `file://${process.cwd()}/`).pathname;
const OUT = process.env.OUT || '/tmp/popup.png';

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox'],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const id = new URL(sw.url()).host;
const p = await ctx.newPage();
await p.setViewportSize({ width: 400, height: 640 });
await p.goto(`chrome-extension://${id}/src/popup/index.html`);
await p.waitForTimeout(800);

// Seed through the app's own Dexie database so the UI sees real entries.
await p.evaluate(async () => {
  const now = Date.now();
  const day = 86400000;
  const rows = [
    ['serendipity', 'sự tình cờ may mắn', 'A serendipity of timing brought them together.', ['noun', 'C1'], true, 0],
    ['ubiquitous', 'phổ biến khắp nơi', 'Smartphones are ubiquitous in modern life.', ['adjective'], false, 1],
    ['ephemeral', 'phù du, chóng tàn', 'Fame can be ephemeral.', ['adjective', 'C1'], true, 2],
    ['to raise concerns', 'gây lo ngại', 'The report has raised concerns.', ['collocation'], false, 3],
    ['meticulous', 'tỉ mỉ', 'She kept meticulous records.', ['adjective'], false, 5],
  ];
  const req = indexedDB.open('vocab');
  const db = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  const tx = db.transaction('vocabulary', 'readwrite');
  const store = tx.objectStore('vocabulary');
  rows.forEach(([word, note, sentence, tags, favorite, age], i) => {
    store.put({
      id: `seed-${i}`,
      word,
      wordKey: word.toLowerCase(),
      phrase: word.includes(' '),
      note,
      sentence,
      sourceUrl: 'https://example.com/article',
      sourceTitle: 'Example article',
      tags,
      favorite,
      createdAt: now - age * day,
      updatedAt: now - age * day,
    });
  });
  await new Promise((res) => (tx.oncomplete = res));
});
await p.reload();
await p.waitForTimeout(1500);
await p.screenshot({ path: OUT, fullPage: true });
console.log('SHOT', OUT);
await ctx.close();
