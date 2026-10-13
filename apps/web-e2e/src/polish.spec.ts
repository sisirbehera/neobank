import { expect, test, type Page } from '@playwright/test';

async function register(page: Page, name: string, email: string) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('secret123');
  await page.getByLabel('Confirm password').fill('secret123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('an unknown address shows a 404 page instead of going home', async ({
  page,
}) => {
  await page.goto('/no-such-page');

  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
  await expect(page.getByText('/no-such-page')).toBeVisible();
  await expect(page).toHaveTitle('Page not found · NeoBank');
  await page.getByRole('link', { name: 'Go to home page' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('idle logout: warns after 4 minutes, "stay" keeps you in, 5 minutes signs you out', async ({
  page,
}) => {
  // The page's clock is controlled by the test, so no real waiting.
  await page.clock.install();
  await register(page, 'Idle Ida', `idle-${Date.now()}@example.com`);

  await page.clock.fastForward('04:01');
  const warning = page.getByRole('alertdialog', {
    name: 'Are you still there?',
  });
  await expect(warning).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Stay signed in' }),
  ).toBeFocused();

  await page.getByRole('button', { name: 'Stay signed in' }).click();
  await expect(warning).toBeHidden();

  await page.clock.fastForward('05:01');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('toast')).toContainText(
    'signed out after 5 minutes without activity',
  );
});

test('security activity lists sign-ins and failed attempts; toasts confirm actions', async ({
  page,
}) => {
  const email = `activity-${Date.now()}@example.com`;
  await register(page, 'Asha Rao', email);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('toast')).toContainText("You're logged out");

  // Someone tries a wrong password, then the owner signs in.
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Incorrect email or password')).toBeVisible();
  await page.getByLabel('Password').fill('secret123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Security' }).click();
  const items = page.getByTestId('security-activity').locator('li');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('Signed in');
  await expect(items.nth(0)).toContainText('This device');
  await expect(items.nth(1)).toContainText('Failed sign-in attempt');
  await expect(items.nth(2)).toContainText('Signed in'); // registration
});
