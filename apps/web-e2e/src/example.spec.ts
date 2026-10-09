import { expect, test } from '@playwright/test';

test('home page shows a healthy system', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('h1')).toContainText('Welcome to NeoBank');
  await expect(page.getByText('online')).toBeVisible();
  await expect(page.getByText('₹12,34,567.89')).toBeVisible();
});

test('theme switcher changes and remembers the theme', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Change theme' }).click();
  await page.getByRole('button', { name: 'Emerald' }).click();

  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-nb-theme', 'emerald');

  await page.reload();
  await expect(html).toHaveAttribute('data-nb-theme', 'emerald');
});
