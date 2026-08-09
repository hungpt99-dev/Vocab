import { chromium } from '@playwright/test';
const EXT = new URL('./dist', `file://${process.cwd()}/`).pathname;
const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox'],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const id = new URL(sw.url()).host;
const p = await ctx.newPage();
await p.setViewportSize({ width: 400, height: 600 });
await p.goto(`chrome-extension://${id}/src/popup/index.html`);
await p.waitForTimeout(500);
await p.evaluate(() => new Promise((r) => chrome.storage.local.set({'avs:onboarded':true,'avs:vocabulary':[
 {id:'1',word:'serendipity',translation:'sự tình cờ may mắn',context:'A serendipity discovery.',sourceUrl:'https://a.com',sourceTitle:'A',tags:['noun'],favorite:true,createdAt:Date.now(),updatedAt:Date.now(),review:{ease:2.5,interval:1,due:Date.now(),reps:1,lapses:0}},
 {id:'2',word:'ubiquitous',translation:'phổ biến khắp nơi',context:'Phones are ubiquitous.',sourceUrl:'https://b.com',sourceTitle:'B',tags:['adj'],favorite:false,createdAt:Date.now(),updatedAt:Date.now(),review:{ease:2.5,interval:3,due:Date.now()+86400000,reps:2,lapses:0}},
 {id:'3',word:'ephemeral',translation:'phù du',context:'Fame is ephemeral.',sourceUrl:'https://c.com',sourceTitle:'C',tags:[],favorite:false,createdAt:Date.now(),updatedAt:Date.now(),review:{ease:2.5,interval:1,due:Date.now(),reps:0,lapses:0}}]}, r)));
await p.reload();
await p.waitForTimeout(1200);
await p.screenshot({ path: '/tmp/popup-before.png', fullPage: true });
console.log('SHOT OK');
await ctx.close();
