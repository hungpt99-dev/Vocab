import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/** Open the extension popup as a normal page. */
async function openPopup(page: Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await expect(page.getByRole('heading', { name: 'Vocab Saver' })).toBeVisible();
  return page;
}

async function saveWord(page: Page, word: string, note = '') {
  await page.getByLabel('Word or phrase').fill(word);
  if (note) await page.getByLabel('Note').fill(note);
  await page.getByRole('button', { name: /save to vocabulary/i }).click();
  await expect(page.getByText(`Saved “${word}”.`)).toBeVisible();
}

test('popup loads without console errors', async ({ page, extensionId }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await openPopup(page, extensionId);
  await expect(page.getByText('No words yet')).toBeVisible();
  expect(errors).toEqual([]);
});

test('saves a word and lists it in the library', async ({ page, extensionId }) => {
  await openPopup(page, extensionId);
  await saveWord(page, 'serendipity', 'from an article');

  const item = page.getByRole('listitem').filter({ hasText: 'serendipity' });
  await expect(item).toBeVisible();
  await expect(item.getByText('from an article')).toBeVisible();
  await expect(page.getByText('1 word')).toBeVisible();
});

test('searches, favorites, edits and deletes an entry', async ({ page, extensionId }) => {
  await openPopup(page, extensionId);
  await saveWord(page, 'serendipity');
  await saveWord(page, 'ephemeral');
  await expect(page.getByText('2 words')).toBeVisible();

  // Search narrows the list.
  await page.getByLabel('Search vocabulary').fill('ephem');
  await expect(page.getByText('1 word')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'ephemeral' })).toBeVisible();
  await page.getByLabel('Search vocabulary').fill('');
  await expect(page.getByText('2 words')).toBeVisible();

  // Favorite, then filter by favorites.
  await page.getByRole('button', { name: 'Favorite serendipity' }).click();
  await expect(page.getByRole('button', { name: 'Unfavorite serendipity' })).toBeVisible();
  await page.getByRole('button', { name: /favorites/i }).click();
  await expect(page.getByText('1 word')).toBeVisible();
  await page.getByRole('button', { name: /favorites/i }).click();

  // Edit renames the entry.
  await page.getByRole('button', { name: 'Edit ephemeral' }).click();
  await page.getByLabel('Word', { exact: true }).fill('transient');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'transient' })).toBeVisible();

  // Delete requires confirmation.
  await page.getByRole('button', { name: 'Delete transient' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'transient' })).toHaveCount(0);
  await expect(page.getByText('1 word')).toBeVisible();
});

test('highlights saved words on a web page with a hover card', async ({ page, context, extensionId, samplePageUrl }) => {
  const popup = await context.newPage();
  await openPopup(popup, extensionId);
  await saveWord(popup, 'serendipity', 'a lucky find');
  await popup.close();

  await page.goto(samplePageUrl);

  const highlights = page.locator('mark.avs-highlight');
  await expect(highlights.first()).toBeVisible({ timeout: 10_000 });
  await expect(highlights).toHaveCount(2);
  await expect(highlights.first()).toHaveText(/serendipity/i);

  // Hovering reveals the meaning/note/date card.
  await highlights.first().hover();
  const card = page.locator('#avs-hover-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('serendipity');
  await expect(card).toContainText('a lucky find');

  // Regression: the card must stay open when the cursor crosses the gap onto it
  // (it used to close instantly on mouseout before the user could reach it).
  const box = await card.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(card).toBeVisible();
  }
});

test('options page persists settings and toggles highlighting', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();

  // Edit the default provider, switch it to Anthropic and set a key.
  await page.getByRole('button', { name: /^Edit/ }).first().click();
  await page.getByLabel('Provider', { exact: true }).selectOption('anthropic');
  await page.getByLabel('API key').fill('sk-test-key');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByLabel('Highlight colour').fill('#ff8800');
  await page.getByLabel(/Highlight saved words/).uncheck();

  await page.reload();
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();

  // Reopen the editor to verify the provider persisted.
  await page.getByRole('button', { name: /^Edit/ }).first().click();
  await expect(page.getByLabel('Provider', { exact: true })).toHaveValue('anthropic');
  await expect(page.getByLabel('API key')).toHaveValue('sk-test-key');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByLabel('Highlight colour')).toHaveValue('#ff8800');
  await expect(page.getByLabel(/Highlight saved words/)).not.toBeChecked();
});

test('disabling highlighting removes highlights from pages', async ({ page, context, extensionId, samplePageUrl }) => {
  const popup = await context.newPage();
  await openPopup(popup, extensionId);
  await saveWord(popup, 'serendipity');
  await popup.close();

  await page.goto(samplePageUrl);
  await expect(page.locator('mark.avs-highlight').first()).toBeVisible({ timeout: 10_000 });

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await options.getByLabel(/Highlight saved words/).uncheck();
  await options.close();

  await expect(page.locator('mark.avs-highlight')).toHaveCount(0, { timeout: 10_000 });
});

test('exports the vocabulary as a JSON backup', async ({ page, extensionId }) => {
  await openPopup(page, extensionId);
  await saveWord(page, 'serendipity');

  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();

  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^ai-vocabulary-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByText(/Exported 1 words?\./)).toBeVisible();
});

test('bilingual settings: language picker, toggle and editable prompt persist', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();

  // Target language picker (Bilingual mode section) — free-text field with datalist.
  await page.getByLabel('Target language').fill('Vietnamese');
  // Bilingual toggle.
  await page.getByLabel(/Bilingual mode/).uncheck();
  // Editable explain prompt.
  const prompt = page.getByLabel('Explain prompt');
  await expect(prompt).toBeVisible();
  await prompt.fill('Explain {{word}} in {{language}}. Be concise.');

  await page.reload();
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();

  await expect(page.getByLabel('Target language')).toHaveValue('Vietnamese');
  await expect(page.getByLabel(/Bilingual mode/)).not.toBeChecked();
  await expect(page.getByLabel('Explain prompt')).toHaveValue(
    'Explain {{word}} in {{language}}. Be concise.',
  );

  // Reset to default clears the template.
  await page.getByRole('button', { name: 'Reset to default' }).click();
  await expect(page.getByLabel('Explain prompt')).toHaveValue('');
});

test('popup bilingual switch activates the headbar on the page', async ({ context, extensionId, samplePageUrl }) => {
  // A content page that should react to the bilingual setting.
  const content = await context.newPage();
  await content.goto(samplePageUrl);
  await content.waitForTimeout(300);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

  const toggle = popup.getByRole('switch', { name: /Bilingual mode/ });
  await expect(toggle).toBeVisible();

  // Flip to a known state: ensure it ends ON.
  const isOn = (await toggle.getAttribute('aria-checked')) === 'true';
  if (!isOn) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(popup.getByRole('switch', { name: /Bilingual mode/ })).not.toHaveAttribute(
    'aria-busy',
    'true',
  );

  // Content page must now show the reader's bilingual control.
  await expect(content.locator('.avs-inline-control')).toBeVisible({ timeout: 10_000 });

  // Mode depth (Word / Sentence) is controlled from the in-page control, not the
  // popup, so the popup only needs to expose the Bilingual on/off switch. We
  // confirm flipping it off hides the control again.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(content.locator('.avs-inline-control')).toBeHidden({ timeout: 10_000 });

  await popup.close();
  await content.close();
});
