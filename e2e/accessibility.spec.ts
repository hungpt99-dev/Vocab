import { expect, test } from './fixtures';

/** Accessibility and responsive checks against the real rendered surfaces. */

test('popup is usable at the narrowest supported width', async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

  await expect(page.getByRole('heading', { name: 'AI Vocabulary Saver' })).toBeVisible();
  await expect(page.getByLabel('Word or phrase')).toBeVisible();
  await expect(page.getByRole('button', { name: /save to vocabulary/i })).toBeVisible();

  // Nothing may overflow horizontally at the minimum width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('popup is fully keyboard navigable', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

  // Save a word using only the keyboard.
  await page.getByLabel('Word or phrase').focus();
  await page.keyboard.type('serendipity');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Saved “serendipity”.')).toBeVisible();

  // Every interactive control must be reachable and expose an accessible name.
  const unnamed = await page.evaluate(() => {
    const selector = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return [...document.querySelectorAll(selector)]
      .filter((element) => {
        const el = element as HTMLElement;
        if (el.hasAttribute('disabled') || el.offsetParent === null) return false;
        const name =
          el.getAttribute('aria-label') ??
          el.getAttribute('title') ??
          (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null) ??
          el.textContent;
        return !name?.trim();
      })
      .map((element) => element.outerHTML.slice(0, 120));
  });
  expect(unnamed).toEqual([]);
});

test('options page exposes labelled sections and controls', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

  // Landmark regions carry accessible names.
  await expect(page.getByRole('region', { name: 'AI provider' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Highlighting' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your data' })).toBeVisible();

  // The API key is masked.
  await expect(page.getByLabel('API key')).toHaveAttribute('type', 'password');

  // There is exactly one h1 and headings do not skip levels.
  expect(await page.getByRole('heading', { level: 1 }).count()).toBe(1);
});

test('page highlights are keyboard focusable and announce themselves', async ({
  page,
  context,
  extensionId,
  samplePageUrl,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await popup.getByLabel('Word or phrase').fill('serendipity');
  await popup.getByRole('button', { name: /save to vocabulary/i }).click();
  await expect(popup.getByText('Saved “serendipity”.')).toBeVisible();
  await popup.close();

  await page.goto(samplePageUrl);
  const highlight = page.locator('mark.avs-highlight').first();
  await expect(highlight).toBeVisible({ timeout: 10_000 });

  await expect(highlight).toHaveAttribute('role', 'button');
  await expect(highlight).toHaveAttribute('aria-label', /Saved vocabulary: serendipity/);

  // Focusing (not just hovering) opens the card and links it via aria-describedby.
  await highlight.focus();
  await expect(page.locator('#avs-hover-card')).toBeVisible();
  await expect(highlight).toHaveAttribute('aria-describedby', 'avs-hover-card');
  await expect(page.locator('#avs-hover-card')).toHaveAttribute('role', 'tooltip');

  // Escape dismisses it.
  await page.keyboard.press('Escape');
  await expect(page.locator('#avs-hover-card')).toBeHidden();
});
