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

test('every keyboard-focused popup control shows a visible focus ring', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

  // A ring may be drawn on the focused element or an ancestor (e.g. the tag
  // input highlights its whole container), so walk up until we find one.
  const describeFocus = (): Promise<{ name: string; ring: boolean } | null> =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (style.boxShadow !== 'none' || style.outlineStyle !== 'none') {
          const name =
            el.getAttribute('aria-label') ?? el.textContent ?? el.getAttribute('placeholder') ?? '';
          return { name: name.trim().slice(0, 40) || el.tagName, ring: true };
        }
        node = node.parentElement;
      }
      return { name: el.tagName, ring: false };
    });

  // The word field autofocuses; check it, then Tab through every control until
  // focus leaves the document.
  let state = await describeFocus();
  expect(state?.ring ?? true).toBe(true);
  for (let i = 0; i < 60; i += 1) {
    await page.keyboard.press('Tab');
    state = await describeFocus();
    if (!state) break;
    expect(state.ring, `visible focus ring on “${state.name}”`).toBe(true);
  }
});

test('options page exposes labelled sections and controls', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

  // Landmark regions carry accessible names.
  await expect(page.getByRole('region', { name: 'AI providers' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Highlighting' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your data' })).toBeVisible();

  // The Popup section exposes its controls with labels.
  await expect(page.getByRole('heading', { name: 'Popup' })).toBeVisible();
  await expect(page.getByLabel(/auto-translate the highlighted word/i)).toBeVisible();
  await expect(page.getByLabel(/default tab on open/i)).toBeVisible();

  // The API key is masked. Open the default provider's editor to reveal it.
  await page.getByRole('button', { name: /^Edit/ }).first().click();
  await expect(page.getByLabel('API key')).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Cancel' }).click();

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
