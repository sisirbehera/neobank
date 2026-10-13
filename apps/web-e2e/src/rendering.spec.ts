import { expect, test } from '@playwright/test';

test.describe('pages built ahead of time', () => {
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('the log-in and home pages still show their content', async ({
      page,
    }) => {
      await page.goto('/login');
      await expect(page.getByText('Log in to NeoBank')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();

      await page.goto('/');
      await expect(page.locator('h1')).toHaveText('Welcome to NeoBank');
    });
  });

  test('typing and clicking before the app has loaded still signs you in', async ({
    page,
  }) => {
    // Hold back the app's JavaScript, like a phone on a slow network.
    let release = () => undefined as void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/main(-[\w-]+)?\.js$/, async (route) => {
      await held;
      await route.continue();
    });

    await page.goto('/login', { waitUntil: 'commit' });
    await page.getByLabel('Email').fill('demo@neobank.dev');
    await page.getByLabel('Password').fill('Demo@1234');
    await page.getByRole('button', { name: 'Log in' }).click();
    // No full-page reload: the typed text is still there.
    await expect(page.getByLabel('Email')).toHaveValue('demo@neobank.dev');

    release();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
