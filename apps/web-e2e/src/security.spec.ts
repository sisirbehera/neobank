import { expect, test, type Page } from '@playwright/test';
import { totp } from './support/totp';

async function register(page: Page, name: string, email: string) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('secret123');
  await page.getByLabel('Confirm password').fill('secret123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('2FA: set up, sign in with a backup code, step-up for a new payee, password and sessions', async ({
  page,
}) => {
  const stamp = Date.now();

  // Someone to pay later.
  await register(page, 'Ravi Kumar', `ravi-2fa-${stamp}@example.com`);
  await page.getByRole('link', { name: 'Open your first account' }).click();
  await page.getByRole('button', { name: 'Open account' }).click();
  await expect(page).toHaveURL(/\/accounts\/[a-f0-9]{24}$/);
  const raviNumber = (
    await page.locator('.font-monospace').first().innerText()
  ).trim();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/); // logout finished

  // Asha turns on two-step verification.
  const email = `asha-2fa-${stamp}@example.com`;
  await register(page, 'Asha Rao', email);
  await page.getByRole('link', { name: 'Security' }).click();
  await page.getByRole('button', { name: 'Set up' }).click();
  const secret = (await page.getByTestId('mfa-secret').innerText()).replace(
    /\s/g,
    '',
  );
  await page.getByLabel('6-digit code').fill(totp(secret));
  await page
    .getByRole('button', { name: 'Turn on two-step verification' })
    .click();

  const codes = page.getByTestId('backup-codes').locator('li');
  await expect(codes).toHaveCount(10);
  const backupCode = (await codes.first().innerText()).trim();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByLabel('I have saved my backup codes').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('On', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/); // logout finished

  // Signing in now asks for a second step. A backup code works (once).
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('secret123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Two-step verification')).toBeVisible();
  await page.getByLabel('Verification code').fill(backupCode);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Adding a beneficiary asks for a fresh code, then goes through.
  await page.getByRole('link', { name: 'Beneficiaries' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Ravi');
  await page.getByLabel('Account number').fill(raviNumber);
  await page.getByRole('button', { name: 'Add beneficiary' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByText('Adding a new beneficiary needs a fresh code.'),
  ).toBeVisible();
  await dialog
    .getByLabel('Code from your authenticator app')
    .fill(totp(secret, 1));
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Ravi was added')).toBeVisible();

  // Change the password; this device stays signed in.
  await page.getByRole('link', { name: 'Security' }).click();
  await page.getByLabel('Current password').fill('secret123');
  await page.getByLabel('New password', { exact: true }).fill('better-pass2');
  await page.getByLabel('Confirm new password').fill('better-pass2');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Password changed.')).toBeVisible();

  // Only this device is left in the sessions list, marked as 2-step.
  await expect(page.getByText('This device')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Sign out all other devices/ }),
  ).toHaveCount(0);
});
