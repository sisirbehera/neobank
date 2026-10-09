import { totp } from './support/totp';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('demo user: chart, filtered history and CSV statement', async ({
  page,
}) => {
  // The login page offers the demo account when the server runs in demo mode.
  await page.goto('/login');
  await page.getByRole('button', { name: 'Fill in' }).click();
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('h1')).toHaveText('Hello, Priya Sharma');

  // Six months of money in / out, with a table view of the same numbers.
  const chart = page.locator('nb-column-chart');
  await expect(chart.getByRole('img')).toBeVisible();
  await chart.getByRole('button', { name: 'Show table' }).click();
  await expect(chart.locator('tbody tr')).toHaveCount(6);

  // Full history, filtered through the URL.
  await page.getByRole('link', { name: 'View all' }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText(/Showing 1–20 of \d+/)).toBeVisible();

  await page.getByLabel('Search').fill('salary');
  await expect(page).toHaveURL(/q=salary/);
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toContainText('Salary – Acme Corp');
  const salaryRows = await rows.count();
  expect(salaryRows).toBeGreaterThanOrEqual(5);
  for (let i = 0; i < salaryRows; i++) {
    await expect(rows.nth(i)).toContainText('Salary');
  }

  // The filtered view survives a reload (it lives in the URL).
  await page.reload();
  await expect(page.getByLabel('Search')).toHaveValue('salary');
  await expect(rows).toHaveCount(salaryRows);

  // Export the same filtered statement.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^neobank-statement-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const csv = await readFile((await download.path()) as string, 'utf8');
  const lines = csv.replace('﻿', '').trim().split('\r\n');
  expect(lines[0]).toContain('Date (IST),Account,Type');
  expect(lines).toHaveLength(salaryRows + 1);
  expect(lines[1]).toContain('Salary – Acme Corp');
});

test('admin freezes a customer account; the customer can no longer move money', async ({
  page,
}) => {
  // A fresh customer with an account.
  const email = `freeze-${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Freeze Target');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('secret123');
  await page.getByLabel('Confirm password').fill('secret123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('link', { name: 'Open your first account' }).click();
  await page.getByRole('button', { name: 'Open account' }).click();
  await expect(page).toHaveURL(/\/accounts\/[a-f0-9]{24}$/);
  const accountUrl = page.url();

  // Customers can't open the admin area.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Log out' }).click();

  // Admin finds the customer and freezes the account with a reason.
  // Admins must set up two-step verification on their first sign-in.
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@neobank.dev');
  await page.getByLabel('Password').fill('Admin@1234');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(
    page.getByText('Admin accounts must use two-step verification'),
  ).toBeVisible();
  const secret = (await page.getByTestId('mfa-secret').innerText()).replace(
    /\s/g,
    '',
  );
  await page.getByLabel('6-digit code').fill(totp(secret));
  await page
    .getByRole('button', { name: 'Turn on two-step verification' })
    .click();
  await page.getByLabel('I have saved my backup codes').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByText('Deposits held')).toBeVisible();
  await page.getByRole('link', { name: 'Users' }).click();
  await page.getByLabel('Search users').fill('Freeze Target');
  await page.getByRole('link', { name: 'Freeze Target' }).click();
  await page.getByRole('button', { name: 'Freeze' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Freeze' }).click();
  await expect(dialog.getByText('at least 3 characters')).toBeVisible();
  await dialog.getByLabel('Reason').fill('Suspicious activity reported');
  await dialog.getByRole('button', { name: 'Freeze' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Unfreeze' })).toBeVisible();

  // The action is in the audit log.
  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(page.getByText('Suspicious activity reported')).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();

  // The customer sees the frozen account with money movement disabled.
  await logIn(page, email, 'secret123');
  await page.goto(accountUrl);
  await expect(page.getByText('frozen', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add money' })).toBeDisabled();
});
