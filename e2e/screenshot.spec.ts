import { test, expect } from './fixtures';

async function saveWord(page: import('@playwright/test').Page, word: string, note: string, tags: string[]) {
  await page.getByLabel('Word or phrase').fill(word);
  await page.getByLabel('Note').fill(note);
  const tagInput = page.getByLabel('Tags');
  for (const tag of tags) {
    await tagInput.type(`${tag},`);
  }
  await page.getByRole('button', { name: /save to vocabulary/i }).click();
  await page.waitForTimeout(250);
}

test('capture screenshots of popup (with entries) and options', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await popup.waitForTimeout(500);
  await saveWord(popup, 'serendipity', 'A happy accident.', ['mood', 'writing']);
  await saveWord(popup, 'ephemeral', 'Lasting a short time.', ['time']);
  await popup.waitForTimeout(500);
  await popup.screenshot({ path: 'test-results/popup.png', fullPage: true });

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await options.waitForTimeout(500);
  await options.screenshot({ path: 'test-results/options.png', fullPage: true });

  expect(true).toBe(true);
});
