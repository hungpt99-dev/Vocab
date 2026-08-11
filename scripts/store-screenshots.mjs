/**
 * Store asset generator: real screenshots of the built extension plus the
 * promotional banner and tile, composed from those same real captures.
 *
 * Usage:
 *   npm run build          # must exist first (loads dist/)
 *   node scripts/store-screenshots.mjs
 *
 * Outputs into store-assets/. Nothing here ships inside the extension zip.
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const DIST = resolve(ROOT, 'dist');
const OUT = resolve(ROOT, 'store-assets');

const SHOT = 1280;
const SHOT_HEIGHT = 800;

/** Original, self-authored article text so the in-page shots are genuinely ours. */
const ARTICLE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Why we keep a word journal</title>
<style>
  body { margin: 0; background: #f5f3ee; font-family: Georgia, 'Times New Roman', serif; color: #1f2937; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 32px 80px; background: #fffdf7; min-height: 100vh; }
  h1 { font-size: 32px; line-height: 1.25; margin: 0 0 8px; color: #111827; }
  .byline { font-size: 13px; color: #6b7280; font-style: italic; margin-bottom: 32px; }
  p { font-size: 17px; line-height: 1.75; margin: 0 0 20px; }
  h2 { font-size: 22px; margin: 36px 0 12px; color: #111827; }
</style></head><body><main>
  <h1>Why we keep a word journal</h1>
  <p class="byline">A quiet habit for anyone who reads a lot</p>
  <p>Every serious reader meets words they half-know. Most of us nod, guess from context, and move on. The word is gone by the next page. Keeping a small journal of those meetings is a habit with an outsized payoff, and the serendipity of running into the same word twice is what makes it stick.</p>
  <p>The value is not in the list itself. It is in the noticing. A dictionary explains ephemeral as lasting a very short time, but the word becomes yours only when you have caught it describing something you care about.</p>
  <p>Vocabulary grows fastest at the edges. The most useful words to record are ordinary ones doing extraordinary work — meticulous in a review of someone's craft, resilient in a story about recovery. These words are ubiquitous in good writing and absent from casual speech.</p>
  <p>The practice is ancient and the tool can be trivial. What matters is that the gesture exists at all: a word caught, a sentence kept, a memory made.</p>
</main></body></html>`;

const WORDS = [
  { word: 'serendipity', sentence: 'The serendipity of running into the same word twice is what makes it stick.', note: 'Found in "Why we keep a word journal"', favorite: true, tags: ['reading'] },
  { word: 'ephemeral', sentence: 'A dictionary explains ephemeral as lasting a very short time.', note: '', favorite: false, tags: ['adjectives'] },
  { word: 'meticulous', sentence: 'Meticulous in a review of someone\'s craft.', note: 'Perfect for describing careful work.', favorite: false, tags: ['adjectives'] },
  { word: 'resilient', sentence: 'Resilient in a story about recovery.', note: '', favorite: false, tags: [] },
  { word: 'ubiquitous', sentence: 'These are the words that are ubiquitous in good writing.', note: '', favorite: false, tags: [] },
];

function explanation(word) {
  const t = {
    serendipity: {
      meaning: 'The occurrence of events by chance in a happy or beneficial way.',
      simpleExplanation: 'When a lucky accident leads to something wonderful.',
      translation: 'sự tình cờ may mắn',
      examples: ['Meeting my co-author there was pure serendipity.', 'The discovery was a happy piece of serendipity.'],
      synonyms: ['chance', 'luck', 'fortuity', 'happy accident'],
      antonyms: ['misfortune', 'bad luck'],
      relatedWords: ['serendipitous', 'serendipitously'],
      pronunciation: '/ˌserənˈdipədē/',
      collocations: ['pure serendipity', 'a stroke of serendipity', 'serendipity in finding'],
      grammar: 'countable or uncountable noun; often uncountable in this sense',
      partOfSpeech: 'noun',
      usage: 'Neutral-to-positive register; common in essays and storytelling.',
      register: 'neutral',
      etymology: 'Coined by Horace Walpole (1754), from the Persian fairy tale "The Three Princes of Serendip".',
      relatedPhrases: ['a stroke of luck', 'a happy accident'],
      provider: 'openai',
      model: 'gpt-4o-mini',
      generatedAt: Date.now(),
    },
    ephemeral: {
      meaning: 'Lasting for a very short time.',
      simpleExplanation: 'Something that is here for a moment and then gone.',
      translation: 'ngắn ngủi, phù du',
      examples: ['Fame on the internet is often ephemeral.', 'Cherish the ephemeral beauty of spring blossoms.'],
      synonyms: ['transient', 'fleeting', 'short-lived', 'momentary'],
      antonyms: ['permanent', 'enduring', 'eternal'],
      relatedWords: ['ephemera', 'ephemerality'],
      pronunciation: '/əˈfem(ə)rəl/',
      collocations: ['ephemeral nature', 'ephemeral beauty'],
      grammar: 'adjective; no comparative forms',
      partOfSpeech: 'adjective',
      usage: 'Formal-to-neutral register; common in essays and journalism.',
      register: 'neutral',
      etymology: 'From Greek ephēmeros, "lasting only a day".',
      relatedPhrases: ['short-lived moment', 'passing fad'],
      provider: 'openai',
      model: 'gpt-4o-mini',
      generatedAt: Date.now(),
    },
    meticulous: {
      meaning: 'Showing great attention to detail; very careful and precise.',
      simpleExplanation: 'Paying attention to every tiny detail.',
      translation: 'tỉ mỉ, cẩn thận',
      examples: ['She kept meticulous records of every experiment.', 'His meticulous planning left nothing to chance.'],
      synonyms: ['careful', 'thorough', 'scrupulous', 'exacting'],
      antonyms: ['careless', 'sloppy', 'negligent'],
      relatedWords: ['meticulously', 'meticulousness'],
      pronunciation: '/məˈtikyələs/',
      collocations: ['meticulous attention to detail', 'meticulous planning', 'meticulous record-keeping'],
      grammar: 'adjective; comparative "more meticulous"',
      partOfSpeech: 'adjective',
      usage: 'Positive register; often used to praise careful work.',
      register: 'neutral',
      etymology: 'From Latin meticulosus, "fearful" — shifted to mean painstaking care.',
      relatedPhrases: ['leave nothing to chance', 'dot the i\u2019s and cross the t\u2019s'],
      provider: 'openai',
      model: 'gpt-4o-mini',
      generatedAt: Date.now(),
    },
    resilient: {
      meaning: 'Able to recover quickly from difficulty; tough.',
      simpleExplanation: 'Bounces back quickly after a hard time.',
      translation: 'kiên cường, bền bỉ',
      examples: ['Children are often more resilient than adults expect.', 'A resilient economy rebounds after shocks.'],
      synonyms: ['tough', 'hardy', 'strong', 'adaptable'],
      antonyms: ['fragile', 'vulnerable', 'weak'],
      relatedWords: ['resilience', 'resiliently'],
      pronunciation: '/rəˈzilyənt/',
      collocations: ['highly resilient', 'resilient economy', 'resilient spirit'],
      grammar: 'adjective; comparative "more resilient"',
      partOfSpeech: 'adjective',
      usage: 'Neutral register; used about people, systems and materials.',
      register: 'neutral',
      etymology: 'From Latin resilire, "to leap back".',
      relatedPhrases: ['bounce back', 'keep going'],
      provider: 'openai',
      model: 'gpt-4o-mini',
      generatedAt: Date.now(),
    },
    ubiquitous: {
      meaning: 'Present, appearing, or found everywhere.',
      simpleExplanation: 'Seen absolutely everywhere.',
      translation: 'phổ biến khắp nơi',
      examples: ['Smartphones are ubiquitous in modern life.', 'The phrase has become ubiquitous in business writing.'],
      synonyms: ['omnipresent', 'everywhere', 'pervasive', 'universal'],
      antonyms: ['rare', 'scarce'],
      relatedWords: ['ubiquity'],
      pronunciation: '/yo͞oˈbikwədəs/',
      collocations: ['ubiquitous in', 'virtually ubiquitous'],
      grammar: 'adjective; no comparative forms',
      partOfSpeech: 'adjective',
      usage: 'Formal register; common in academic and journalistic prose.',
      register: 'neutral',
      etymology: 'From Latin ubique, "everywhere".',
      relatedPhrases: ['all over the place', 'around every corner'],
      provider: 'openai',
      model: 'gpt-4o-mini',
      generatedAt: Date.now(),
    },
  };
  return t[word];
}

function seedSettings() {
  return {
    providers: [
      { id: 'prov_default', type: 'openai', name: 'OpenAI', apiKey: '', baseUrl: '', model: 'gpt-4o-mini', enabled: true },
    ],
    activeProviderId: 'prov_default',
    fallbackProviderId: undefined,
    targetLanguage: 'Vietnamese',
    highlightEnabled: true,
    highlightColor: '#fde68a',
    autoExplainOnSave: false,
    bilingualMode: true,
    bilingualDomains: [],
    popupShowTranslation: true,
    popupShowSimplify: true,
    popupDefaultTab: 'library',
    explainPromptTemplate: '',
    readingExperience: { showOriginal: true, showTranslation: true, width: 320, fontSize: 15, spacing: 1.4 },
  };
}

async function seedVocabulary(page) {
  const now = Date.now();
  const entries = WORDS.map((w, i) => ({
    id: `seed-${i}`,
    word: w.word,
    wordKey: w.word.toLowerCase(),
    phrase: '',
    sentence: w.sentence,
    sourceUrl: 'http://127.0.0.1:3907/',
    sourceTitle: 'Why we keep a word journal',
    note: w.note,
    tags: w.tags,
    favorite: w.favorite,
    sourceLanguage: 'English',
    explanation: explanation(w.word),
    createdAt: now - (WORDS.length - i) * 86_400_000,
    updatedAt: now - (WORDS.length - i) * 86_400_000,
  }));
  await page.evaluate((rows) => {
    const done = new Promise((resolve, reject) => {
      const open = indexedDB.open('ai-vocabulary-saver');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(['vocabulary', 'review'], 'readwrite');
        tx.objectStore('vocabulary').clear();
        tx.objectStore('review').clear();
        const store = tx.objectStore('vocabulary');
        for (const row of rows) store.put(row);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    return done;
  }, entries);
  await page.evaluate((settings) => {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() =>
        chrome.storage.local.set({ 'avs:settings': settings }, () => resolve()),
      );
    });
  }, seedSettings());
}

function framePopup(page) {
  // Present the popup card centered on a clean canvas (presentation only).
  return page.addStyleTag({
    content: `
      body { display: flex; justify-content: center; padding-top: 48px; background: #eef2ff; }
      #root > div { border-radius: 16px; box-shadow: 0 24px 48px -16px rgba(49,46,129,0.35); }
    `,
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ARTICLE_HTML);
  });
  await new Promise((resolve) => server.listen(3907, '127.0.0.1', resolve));

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const serviceWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(serviceWorker.url()).host;

  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: SHOT, height: SHOT_HEIGHT });
  await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await popupPage.waitForTimeout(600);
  await seedVocabulary(popupPage);
  await popupPage.reload();
  await popupPage.waitForTimeout(1500);

  // 1 — Popup: the vocabulary library.
  await framePopup(popupPage);
  await popupPage.screenshot({ path: resolve(OUT, 'screenshot-popup-library.png') });

  // 2 — Popup: an expanded AI explanation.
  await popupPage.getByRole('button', { name: 'Show enrich data' }).first().click();
  await popupPage.waitForTimeout(400);
  await popupPage.screenshot({ path: resolve(OUT, 'screenshot-popup-explanation.png') });
  await popupPage.getByRole('button', { name: 'Hide enrich data' }).first().click();

  // 3 — Options: AI providers (bring-your-own-key).
  const optionsPage = await context.newPage();
  await optionsPage.setViewportSize({ width: SHOT, height: SHOT_HEIGHT });
  await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await optionsPage.waitForTimeout(800);
  await optionsPage.getByRole('button', { name: /^Edit/ }).first().click();
  await optionsPage.waitForTimeout(300);
  await optionsPage.screenshot({ path: resolve(OUT, 'screenshot-options-providers.png') });
  await optionsPage.getByRole('button', { name: 'Cancel' }).click();

  // 4 — Options: bilingual reading settings.
  await optionsPage.getByRole('button', { name: 'Bilingual reading' }).click();
  await optionsPage.waitForTimeout(300);
  await optionsPage.screenshot({ path: resolve(OUT, 'screenshot-options-bilingual.png') });

  // 5 — In-page: saved-word highlight + hover card.
  const articlePage = await context.newPage();
  await articlePage.setViewportSize({ width: SHOT, height: SHOT_HEIGHT });
  await articlePage.goto('http://127.0.0.1:3907/');
  const highlight = articlePage.locator('mark.avs-highlight').first();
  await highlight.waitFor({ state: 'visible', timeout: 15_000 });
  await highlight.hover();
  await articlePage.locator('#avs-hover-card').waitFor({ state: 'visible', timeout: 10_000 });
  await articlePage.waitForTimeout(400);
  await articlePage.screenshot({ path: resolve(OUT, 'screenshot-page-highlight.png') });

  // 6 — In-page: selection card on selected text.
  await articlePage.evaluate(() => {
    const needle = 'serendipity';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const start = node.data.indexOf(needle);
      if (start !== -1) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + needle.length);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        return true;
      }
    }
    return false;
  });
  await articlePage.locator('#avs-selection-card').waitFor({ state: 'visible', timeout: 10_000 });
  await articlePage.waitForTimeout(1200);
  await articlePage.screenshot({ path: resolve(OUT, 'screenshot-page-selection-card.png') });

  // 7 — In-page: bilingual reading mode (auto-opens on load, per settings).
  const bilingual = await context.newPage();
  await bilingual.setViewportSize({ width: SHOT, height: SHOT_HEIGHT });
  await bilingual.goto('http://127.0.0.1:3907/');
  await bilingual.locator('.avs-inline-translation').first().waitFor({ state: 'visible', timeout: 60_000 });
  await bilingual.waitForTimeout(1500);
  await bilingual.screenshot({ path: resolve(OUT, 'screenshot-page-bilingual.png') });

  const bannerShots = [
    { name: 'promo-large.png', width: 1400, height: 560 },
    { name: 'promo-small-tile.png', width: 440, height: 280 },
  ];
  for (const shot of bannerShots) {
    const bannerPage = await context.newPage();
    await bannerPage.setViewportSize({ width: shot.width, height: shot.height });
    await bannerPage.setContent(bannerHtml(shot.width), { waitUntil: 'networkidle' });
    await bannerPage.waitForTimeout(400);
    await bannerPage.screenshot({ path: resolve(OUT, shot.name) });
    await bannerPage.close();
  }

  await context.close();
  await new Promise((resolve) => server.close(resolve));
  console.log('Assets written to', OUT);
}

function bannerHtml(width) {
  const icon = toDataUrl(resolve(ROOT, 'dist/assets/icon128.png'));
  const popupShot = toDataUrl(resolve(OUT, 'screenshot-popup-library.png'));
  const pageShot = toDataUrl(resolve(OUT, 'screenshot-page-highlight.png'));
  const compact = width < 1000;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; box-sizing: border-box; }
    body {
      width: ${width}px; height: ${compact ? 280 : 560}px;
      display: flex; align-items: center;
      background: linear-gradient(120deg, #4f46e5 0%, #4338ca 55%, #312e81 100%);
      font-family: 'Segoe UI', system-ui, sans-serif; color: #fff;
      overflow: hidden; position: relative;
    }
    .orb { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.06); }
    .orb-a { width: ${compact ? 220 : 460}px; height: ${compact ? 220 : 460}px; top: -${compact ? 90 : 200}px; right: -${compact ? 60 : 120}px; }
    .orb-b { width: ${compact ? 150 : 320}px; height: ${compact ? 150 : 320}px; bottom: -${compact ? 60 : 140}px; left: -${compact ? 40 : 90}px; }
    .content { position: relative; z-index: 1; display: flex; align-items: center; gap: ${compact ? 16 : 44}px; padding: 0 ${compact ? 24 : 56}px; width: 100%; }
    .brand { display: flex; flex-direction: column; gap: ${compact ? 8 : 16}px; flex: 1 1 auto; min-width: 0; }
    .logo { display: flex; align-items: center; gap: ${compact ? 10 : 18}px; }
    .logo img { width: ${compact ? 36 : 72}px; height: ${compact ? 36 : 72}px; border-radius: ${compact ? 9 : 18}px; box-shadow: 0 8px 20px rgba(0,0,0,0.25); }
    .logo span { font-size: ${compact ? 20 : 40}px; font-weight: 700; letter-spacing: -0.02em; }
    .tagline { font-size: ${compact ? 11 : 19}px; line-height: 1.5; color: #c7d2fe; max-width: ${compact ? 240 : 460}px; }
    .shots { display: flex; gap: ${compact ? 10 : 20}px; flex: 0 0 auto; }
    .shot { border-radius: ${compact ? 8 : 14}px; box-shadow: 0 18px 40px -12px rgba(0,0,0,0.45); border: 2px solid rgba(255,255,255,0.35); background: #fff; overflow: hidden; }
    .shot img { display: block; }
    .shot.popup img { height: ${compact ? 150 : 300}px; }
    .shot.page img { height: ${compact ? 150 : 300}px; }
  </style></head><body>
    <div class="orb orb-a"></div><div class="orb orb-b"></div>
    <div class="content">
      <div class="brand">
        <div class="logo"><img src="${icon}" alt=""/><span>Vocab Saver</span></div>
        <div class="tagline">Save words while you browse. Highlight them anywhere. Understand and remember every one.</div>
      </div>
      <div class="shots">
        <div class="shot popup"><img src="${popupShot}" alt=""/></div>
        <div class="shot page"><img src="${pageShot}" alt=""/></div>
      </div>
    </div>
  </body></html>`;
}

function toDataUrl(path) {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
