import { expect, test, type Page } from '@playwright/test';

async function registerNewUser(page: Page) {
  const password = 'secret123';
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Account Tester');
  await page.getByLabel('Email').fill(`acct-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('open an account, add money, withdraw, see it on the dashboard', async ({
  page,
}) => {
  await registerNewUser(page);

  // Empty state → open a savings account
  await expect(page.getByText("You don't have any accounts yet")).toBeVisible();
  await page.getByRole('link', { name: 'Open your first account' }).click();
  await page.getByLabel('Nickname (optional)').fill('Rainy day fund');
  await page.getByRole('button', { name: 'Open account' }).click();

  await expect(page).toHaveURL(/\/accounts\/[a-f0-9]{24}$/);
  const balance = page.getByTestId('balance');
  await expect(balance).toHaveText('₹0.00');
  await expect(page.getByText('Rainy day fund')).toBeVisible();

  // Add money
  await page.getByRole('button', { name: 'Add money' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount (₹)').fill('1,500.50');
  await dialog.getByLabel('Description (optional)').fill('Salary');
  await dialog.getByRole('button', { name: 'Add money' }).click();
  await expect(dialog).toBeHidden();
  await expect(balance).toHaveText('₹1,500.50');
  await expect(page.getByText('Salary')).toBeVisible();

  // Withdrawing more than the balance is caught before it reaches the API
  await page.getByRole('button', { name: 'Withdraw' }).click();
  await dialog.getByLabel('Amount (₹)').fill('2000');
  await dialog.getByLabel('Amount (₹)').blur();
  await expect(dialog.getByText('Insufficient funds')).toBeVisible();

  await dialog.getByLabel('Amount (₹)').fill('500');
  await dialog.getByRole('button', { name: 'Withdraw' }).click();
  await expect(dialog).toBeHidden();
  await expect(balance).toHaveText('₹1,000.50');

  // Dashboard shows the total and recent activity
  await page.getByRole('link', { name: '← Dashboard' }).click();
  await expect(page.getByTestId('total-balance')).toHaveText('₹1,000.50');
  await expect(page.getByText('+₹1,500.50')).toBeVisible();
  await expect(page.getByText('-₹500.00')).toBeVisible();
});
