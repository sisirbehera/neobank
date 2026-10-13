import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'secret123';

async function register(page: Page, name: string, email: string) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function openAccount(page: Page) {
  await page.goto('/accounts/new');
  await page.getByRole('button', { name: 'Open account' }).click();
  await expect(page).toHaveURL(/\/accounts\/[a-f0-9]{24}$/);
  return (await page.locator('.font-monospace').first().innerText()).trim();
}

test('money received shows up as a toast and in the bell, and opens the account', async ({
  browser,
}) => {
  const stamp = Date.now();

  // Ravi is signed in, in his own browser. The test controls his page's
  // clock, so "a minute later" (the next check) takes no real time.
  const ravi = await (await browser.newContext()).newPage();
  await ravi.clock.install();
  await register(ravi, 'Ravi Kumar', `ravi-n-${stamp}@example.com`);
  const raviNumber = await openAccount(ravi);
  const bell = ravi.getByTestId('notification-bell');
  await expect(bell).toHaveAccessibleName('Notifications');

  // Asha pays him from another browser.
  const asha = await (await browser.newContext()).newPage();
  await register(asha, 'Asha Rao', `asha-n-${stamp}@example.com`);
  await openAccount(asha);
  await asha.getByRole('button', { name: 'Add money' }).click();
  await asha.getByRole('dialog').getByLabel('Amount (₹)').fill('1000');
  await asha
    .getByRole('dialog')
    .getByRole('button', { name: 'Add money' })
    .click();
  await asha.goto('/beneficiaries');
  await asha.getByLabel('Name', { exact: true }).fill('Ravi');
  await asha.getByLabel('Account number').fill(raviNumber);
  await asha.getByRole('button', { name: 'Add beneficiary' }).click();
  await asha.getByRole('link', { name: 'Pay' }).click();
  await asha.getByLabel('Amount (₹)').fill('250');
  await asha.getByRole('button', { name: 'Continue' }).click();
  await asha.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(asha.getByText('Transfer complete')).toBeVisible();

  // Ravi's next check finds it.
  await ravi.clock.fastForward('01:01');
  await expect(ravi.getByTestId('toast')).toContainText(
    '₹250.00 received from Asha Rao',
  );
  await expect(ravi.getByTestId('notification-count')).toHaveText('1');
  await expect(bell).toHaveAccessibleName('Notifications, 1 unread');

  await bell.click();
  const item = ravi.getByTestId('notification').first();
  await expect(item).toContainText('₹250.00 received from Asha Rao in ••••');
  await item.click();

  await expect(ravi).toHaveURL(/\/accounts\/[a-f0-9]{24}$/);
  await expect(ravi.getByTestId('balance')).toHaveText('₹250.00');
  await expect(ravi.getByTestId('notification-count')).toBeHidden();
});
