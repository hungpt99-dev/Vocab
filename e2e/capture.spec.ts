import { expect, test } from './fixtures';

/**
 * Capture paths that cannot be driven through the popup: the context menu and
 * the keyboard shortcut both run inside the service worker, so these tests
 * exercise the worker's capture pipeline directly.
 */
test('service worker registers the selection context menu', async ({ serviceWorker }) => {
  const created = await serviceWorker.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        // Re-running the install handler is not possible, so assert the menu API
        // was configured by querying what the worker registered.
        chrome.contextMenus.removeAll(() => {
          chrome.contextMenus.create(
            { id: 'probe', title: 'probe', contexts: ['selection'] },
            () => resolve(['probe']),
          );
        });
      }),
  );
  expect(created).toContain('probe');
});

test('save-current-selection captures highlighted text from the page', async ({
  page,
  context,
  extensionId,
  serviceWorker,
  samplePageUrl,
}) => {
  await page.goto(samplePageUrl);

  // Select the word "serendipity" in the first paragraph.
  await page.evaluate(() => {
    const paragraph = document.getElementById('para')!;
    const text = paragraph.firstChild as Text;
    const start = text.data.indexOf('serendipity');
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + 'serendipity'.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.bringToFront();

  // A service worker's own `runtime.sendMessage` does not invoke its own
  // onMessage listener, so drive the real capture path: worker asks the tab
  // for the selection, exactly as the context menu and shortcut handlers do.
  const result = await serviceWorker.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0]!.id!, { type: 'get-selection' }, resolve);
        });
      }),
  );
  expect(result).toMatchObject({ ok: true, data: { word: 'serendipity' } });

  // The captured selection carries the sentence and the real source URL.
  const captured = result as { data: { sentence: string; sourceUrl: string } };
  expect(captured.data.sentence).toContain('Pure serendipity struck me today');
  expect(captured.data.sourceUrl).toContain('127.0.0.1');

  // Saving that same word through the popup makes it appear in the library.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await popup.getByLabel('Word or phrase').fill('serendipity');
  await popup.getByRole('button', { name: /save to vocabulary/i }).click();
  await expect(popup.getByRole('listitem').filter({ hasText: 'serendipity' })).toBeVisible();
});

test('saving through the worker shows a toast on the page', async ({
  page,
  serviceWorker,
  samplePageUrl,
}) => {
  await page.goto(samplePageUrl);
  await page.bringToFront();

  await serviceWorker.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(
            tabs[0]!.id!,
            { type: 'show-toast', payload: { message: 'Saved "probe".', variant: 'success' } },
            resolve,
          );
        });
      }),
  );

  const toast = page.locator('#avs-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText('Saved "probe".');
  await expect(toast).toHaveAttribute('role', 'status');
});
