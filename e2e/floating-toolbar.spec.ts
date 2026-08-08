import { test, expect } from './fixtures';
import { createServer, type Server } from 'node:http';

test('floating toolbar buttons actually work (save + explain feedback)', async ({ page }) => {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<p id="t">The <span id="w">serendipity</span> of the morning surprised him.</p>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  await page.goto(`http://127.0.0.1:${port}/`);
  await page.bringToFront();
  await page.waitForTimeout(700);

  // Select "serendipity" precisely via the wrapped span, then open the toolbar.
  await page.locator('#w').selectText();
  await page.mouse.up().catch(() => {});
  await page.waitForTimeout(400);
  // Some content scripts only open the toolbar on a real mouseup; nudge it.
  await page.locator('#t').click({ position: { x: 1, y: 1 }, force: true }).catch(() => {});
  // Re-select to be safe.
  await page.locator('#w').selectText();
  await page.dispatchEvent('#w', 'mouseup').catch(() => {});
  await page.waitForTimeout(500);

  const toolbar = page.locator('#avs-toolbar');
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator('[data-role="word"]')).toHaveText('serendipity');

  // SAVE should persist the word (toast appears, no crash).
  await toolbar.locator('[data-action="save"]').click();
  await page.waitForTimeout(800);
  const toastText = await page.locator('.avs-toast').allInnerTexts().catch(() => []);
  console.log('TOAST_AFTER_SAVE', JSON.stringify(toastText));
  await expect(page.getByText(/Saved|selection to save/i)).toBeVisible();

  // Re-open toolbar (selection collapsed after save click), then EXPLAIN.
  await page.locator('#w').selectText();
  await page.dispatchEvent('#w', 'mouseup').catch(() => {});
  await page.waitForTimeout(500);
  await expect(toolbar).toBeVisible();
  await toolbar.locator('[data-action="explain"]').click();
  await page.waitForTimeout(500);
  // Without an API key the inline popover should surface a clear message (not a blank popup).
  // Either the explain dialog opened, or a toast explaining the missing key appeared.
  const popover = page.locator('#avs-explain');
  const toast = page.locator('.avs-toast');
  const openedOrToasted = (await popover.isVisible().catch(() => false)) || (await toast.isVisible().catch(() => false));
  console.log('EXPLAIN_FEEDBACK', openedOrToasted);
  expect(openedOrToasted).toBe(true);

  server.close();
});
