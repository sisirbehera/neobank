import { expect, test } from '@playwright/test';

// Runs against the production build (both languages); see playwright.config.

test.describe('English and Hindi', () => {
  test.describe('a browser set to Hindi', () => {
    test.use({ locale: 'hi-IN' });

    test('opens the Hindi site at "/"', async ({ page }) => {
      await page.goto('/');

      await expect(page).toHaveURL(/\/hi\/$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
      await expect(page.locator('h1')).toHaveText('NeoBank में आपका स्वागत है');
    });
  });

  test('the switcher keeps the page, and "/" remembers the choice', async ({
    page,
  }) => {
    await page.goto('/en/login');
    await expect(page).toHaveTitle('Log in · NeoBank');

    await page.getByRole('link', { name: 'हिन्दी' }).click();

    await expect(page).toHaveURL(/\/hi\/login$/);
    await expect(page).toHaveTitle('लॉग इन · NeoBank');
    await page.goto('/');
    await expect(page).toHaveURL(/\/hi\/$/);
  });

  test('the language chosen at sign-up follows the user to a new device', async ({
    page,
    browser,
  }) => {
    const email = `hindi-${Date.now()}@example.com`;
    await page.goto('/hi/register');
    await page.getByLabel('पूरा नाम').fill('Meera Joshi');
    await page.getByLabel('ईमेल').fill(email);
    await page.getByLabel('पासवर्ड', { exact: true }).fill('secret123');
    await page.getByLabel('पासवर्ड की पुष्टि करें').fill('secret123');
    await page.getByRole('button', { name: 'खाता बनाएँ' }).click();
    await expect(page).toHaveURL(/\/hi\/dashboard$/);
    await expect(page.locator('h1')).toHaveText('नमस्ते, Meera Joshi');

    // Another device, in English, that never chose a language.
    const other = await (
      await browser.newContext({ locale: 'en-IN' })
    ).newPage();
    await other.goto('/en/login');
    await other.getByLabel('Email').fill(email);
    await other.getByLabel('Password').fill('secret123');
    await other.getByRole('button', { name: 'Log in' }).last().click();

    await expect(other).toHaveURL(/\/hi\/dashboard$/);
    await other.context().close();
  });

  test('form and API errors are in Hindi', async ({ page }) => {
    await page.goto('/hi/login');
    await page.getByLabel('ईमेल').fill('not-an-email');
    await page.getByLabel('पासवर्ड').fill('wrong-password');
    await page.getByLabel('ईमेल').blur();
    await expect(page.getByText('सही ईमेल पता दर्ज करें')).toBeVisible();

    await page.getByLabel('ईमेल').fill('demo@neobank.dev');
    await page.getByRole('button', { name: 'लॉग इन' }).last().click();
    await expect(page.getByRole('alert')).toHaveText('ईमेल या पासवर्ड गलत है');
  });
});
