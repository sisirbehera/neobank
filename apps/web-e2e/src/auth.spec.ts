import { expect, test } from '@playwright/test';

test('register, stay signed in after reload, log out, log back in', async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'secret123';

  // Register
  await page.goto('/register');
  await page.getByLabel('Full name').fill('E2E Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('h1')).toHaveText('Hello, E2E Tester');

  // The refresh cookie restores the session after a full page reload.
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Hello, E2E Tester');

  // Log out → protected page redirects to login with a return URL.
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard$/);

  // Wrong password shows an error.
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('wrong-password1');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Incorrect email or password',
  );

  // Correct password returns to the page we came from.
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('register form validates with the shared Zod rules', async ({ page }) => {
  await page.goto('/register');

  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(
    page.getByText('Name must be at least 2 characters'),
  ).toBeVisible();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();

  await page.getByLabel('Password', { exact: true }).fill('onlyletters');
  await page.getByLabel('Password', { exact: true }).blur();
  await expect(page.getByText('Password must contain a number')).toBeVisible();

  await page.getByLabel('Confirm password').fill('different1');
  await page.getByLabel('Confirm password').blur();
  await expect(page.getByText('Passwords do not match')).toBeVisible();
});
