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

async function openAccount(page: Page, type: 'Savings' | 'Current') {
  await page.goto('/accounts/new');
  await page.getByText(`${type} account`, { exact: true }).click();
  await page.getByRole('button', { name: 'Open account' }).click();
  await expect(page).toHaveURL(/\/accounts\/[a-f0-9]{24}$/);
  return (await page.locator('.font-monospace').first().innerText()).trim();
}

async function addMoney(page: Page, amount: string) {
  await page.getByRole('button', { name: 'Add money' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount (₹)').fill(amount);
  await dialog.getByRole('button', { name: 'Add money' }).click();
  await expect(dialog).toBeHidden();
}

/** Picks the first <option> whose text contains `text`. */
async function selectByText(page: Page, label: string, text: string) {
  const select = page.getByLabel(label, { exact: true });
  const value = await select
    .locator('option', { hasText: text })
    .first()
    .getAttribute('value');
  await select.selectOption(value ?? '');
}

async function logOut(page: Page) {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test('pay a beneficiary and move money between own accounts', async ({
  page,
}) => {
  const stamp = Date.now();
  const raviEmail = `ravi-${stamp}@example.com`;

  // Ravi opens an account and shares its number.
  await register(page, 'Ravi Kumar', raviEmail);
  const raviNumber = await openAccount(page, 'Savings');
  await logOut(page);

  // Asha opens two accounts and adds money.
  await register(page, 'Asha Rao', `asha-${stamp}@example.com`);
  await openAccount(page, 'Current');
  await openAccount(page, 'Savings');
  await addMoney(page, '5000');

  // Paying Ravi is only possible after adding him as a beneficiary.
  await page.getByRole('link', { name: 'Beneficiaries' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Ravi');
  await page.getByLabel('Account number').fill(raviNumber.toLowerCase());
  await page.getByRole('button', { name: 'Add beneficiary' }).click();
  await expect(page.getByText('Ravi was added')).toBeVisible();

  // Pay Ravi from the beneficiaries list.
  await page.getByRole('link', { name: 'Pay' }).click();
  await expect(page).toHaveURL(/\/transfer\?to=/);
  await page.getByLabel('Amount (₹)').fill('1,250.75');
  await page.getByLabel('Description (optional)').fill('Concert tickets');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByTestId('review-amount')).toHaveText('₹1,250.75');
  await page.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(page.getByText('Transfer complete')).toBeVisible();
  await expect(page.getByTestId('new-balance')).toHaveText('₹3,749.25');

  // Move money to Asha's own current account.
  await page.getByRole('button', { name: 'Make another transfer' }).click();
  await selectByText(page, 'To', 'Current account');
  await page.getByLabel('Amount (₹)').fill('749.25');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(page.getByTestId('new-balance')).toHaveText('₹3,000.00');

  // Total is unchanged by own transfers: ₹5,000 − ₹1,250.75 sent to Ravi.
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByTestId('total-balance')).toHaveText('₹3,749.25');
  await expect(page.getByText('To Ravi · ••••')).toBeVisible();
  await logOut(page);

  // Ravi sees the money and who sent it.
  await page.getByLabel('Email').fill(raviEmail);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByTestId('total-balance')).toHaveText('₹1,250.75');
  await expect(page.getByText('From Asha Rao · ••••')).toBeVisible();
  await expect(page.getByText('Concert tickets')).toBeVisible();
});

test('the review step catches a transfer larger than the balance', async ({
  page,
}) => {
  await register(page, 'Low Balance', `low-${Date.now()}@example.com`);
  await openAccount(page, 'Savings');
  await addMoney(page, '100');
  await openAccount(page, 'Current');

  await page.goto('/transfer');
  await selectByText(page, 'From', 'Savings account');
  await selectByText(page, 'To', 'Current account');
  await page.getByLabel('Amount (₹)').fill('100.01');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(
    page.getByText('Insufficient funds (available ₹100.00)'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirm transfer' }),
  ).toHaveCount(0);
});
