import {
  type AccountStatus,
  MAX_ACCOUNTS_PER_USER,
  MAX_BENEFICIARIES_PER_USER,
} from '@neobank/shared/models';
import { formatInr } from '@neobank/shared/utils';
import { ACCOUNT_STATUS_LABELS } from '../../features/accounts/labels';

/**
 * Validation messages from the shared Zod schemas, and field errors the API
 * returns, are English sentences: the API and the schemas stay
 * language-neutral English (decision record 0013). The browser translates
 * them by their English text. `validation-messages.spec.ts` fails when a
 * message in the shared schemas is missing here; anything missing at runtime
 * is shown in English rather than not at all.
 */
export const VALIDATION_MESSAGES: Record<string, string> = {
  // auth
  'Enter a valid email address': $localize`Enter a valid email address`,
  'Name must be at least 2 characters': $localize`Name must be at least 2 characters`,
  'Name must be at most 80 characters': $localize`Name must be at most 80 characters`,
  'Password is required': $localize`Password is required`,
  'Password must be at least 8 characters': $localize`Password must be at least 8 characters`,
  'Password must be at most 72 characters': $localize`Password must be at most 72 characters`,
  'Password must contain a letter': $localize`Password must contain a letter`,
  'Password must contain a number': $localize`Password must contain a number`,
  // security
  'Current password is required': $localize`Current password is required`,
  'Enter the 6-digit code from your authenticator app': $localize`Enter the 6-digit code from your authenticator app`,
  'Enter the 6-digit code or a backup code': $localize`Enter the 6-digit code or a backup code`,
  'The new password must be different': $localize`The new password must be different`,
  // money and accounts
  'Enter an amount': $localize`Enter an amount`,
  'Enter an amount like 1500 or 1500.50': $localize`Enter an amount like 1500 or 1500.50`,
  'Amount cannot be negative': $localize`Amount cannot be negative`,
  'Amount cannot exceed ₹1,00,000': $localize`Amount cannot exceed ₹1,00,000`,
  'Amount must be a whole number of paise': $localize`Amount must be a whole number of paise`,
  'Amount must be greater than zero': $localize`Amount must be greater than zero`,
  'Description must be at most 100 characters': $localize`Description must be at most 100 characters`,
  'Nickname must be at most 30 characters': $localize`Nickname must be at most 30 characters`,
  // transfers and beneficiaries
  'Account number is required': $localize`Account number is required`,
  'Account numbers look like NB1234567890': $localize`Account numbers look like NB1234567890`,
  'This account number is not valid. Check it for typos.': $localize`This account number is not valid. Check it for typos.`,
  'Choose the account to pay from': $localize`Choose the account to pay from`,
  // history
  'Use the format YYYY-MM-DD': $localize`Use the format YYYY-MM-DD`,
  '"From" must be on or before "To"': $localize`"From" must be on or before "To"`,
  // Field errors sent by the API
  'An account with this email already exists': $localize`An account with this email already exists`,
  'Current password is not correct': $localize`Current password is not correct`,
  'Password is not correct': $localize`Password is not correct`,
  'That code is not correct': $localize`That code is not correct`,
  'This code was already used. Wait for the next one.': $localize`This code was already used. Wait for the next one.`,
  'No NeoBank account has this number': $localize`No NeoBank account has this number`,
  'This account is already in your beneficiaries': $localize`This account is already in your beneficiaries`,
};

/** Messages only staff see (admin screens are English-only). */
export const UNTRANSLATED_VALIDATION_MESSAGES = [
  'Give a short reason (at least 3 characters)',
  'Reason must be at most 200 characters',
  'Idempotency-Key must be 8–100 letters, digits, - or _',
];

type Meta = Record<string, string> | undefined;

/**
 * Text for an API error, chosen by its code (with numbers from `meta`),
 * in the page's language. Unknown codes return undefined: the caller then
 * shows the API's English message.
 */
export function apiErrorText(code: string, meta: Meta): string | undefined {
  const locale = $localize.locale ?? 'en-IN';
  switch (code) {
    case 'STEP_UP_CANCELLED':
      return $localize`Verification was cancelled. Nothing was changed.`;
    case 'NETWORK_ERROR':
      return $localize`Cannot reach the server. Check your connection and try again.`;
    case 'UNKNOWN':
    case 'INTERNAL_ERROR':
      return $localize`Something went wrong. Please try again.`;
    case 'INVALID_CREDENTIALS':
      return $localize`Incorrect email or password`;
    case 'SESSION_EXPIRED':
      return $localize`Your session has expired. Please log in again.`;
    case 'MFA_TOKEN_INVALID':
      return $localize`Your sign-in attempt expired. Please log in again.`;
    case 'MFA_REQUIRED':
      return $localize`Sign in again with two-step verification to continue`;
    case 'EMAIL_TAKEN':
      return $localize`An account with this email already exists`;
    case 'ACCOUNT_LOCKED':
      return meta?.['minutes']
        ? $localize`Too many failed attempts. Try again in ${meta['minutes']}:minutes: minute(s).`
        : $localize`Too many failed attempts. Try again in a few minutes.`;
    case 'TOO_MANY_REQUESTS':
      return $localize`Too many attempts. Please wait a few minutes and try again.`;
    case 'INVALID_CODE':
      return $localize`That code is not correct`;
    case 'CODE_ALREADY_USED':
      return $localize`This code was already used. Wait for the next one.`;
    case 'MFA_ALREADY_ENABLED':
      return $localize`Two-step verification is already on`;
    case 'MFA_NOT_ENABLED':
      return $localize`Turn on two-step verification first`;
    case 'MFA_SETUP_NOT_STARTED':
      return $localize`Start the setup first`;
    case 'DEMO_ACCOUNT':
      return $localize`This is the shared demo account, so its security settings can't be changed. Register your own account to try them.`;
    case 'ACCOUNT_LIMIT':
      return $localize`You can have at most ${MAX_ACCOUNTS_PER_USER}:max: accounts`;
    case 'ACCOUNT_NOT_FOUND':
      return $localize`No NeoBank account has this number`;
    case 'ACCOUNT_NOT_ACTIVE': {
      const status = ACCOUNT_STATUS_LABELS[meta?.['status'] as AccountStatus];
      return status ? $localize`This account is ${status}:status:` : undefined;
    }
    case 'RECIPIENT_NOT_ACTIVE':
      return $localize`The receiving account cannot accept money right now`;
    case 'INSUFFICIENT_FUNDS':
      return $localize`Insufficient funds`;
    case 'DAILY_LIMIT_EXCEEDED':
      return meta?.['limitPaise']
        ? $localize`This would exceed your daily limit of ${formatInr(Number(meta['limitPaise']), locale)}:limit: for transfers to others`
        : $localize`This would exceed your daily limit for transfers to others`;
    case 'BENEFICIARY_REQUIRED':
      return $localize`Add this account as a beneficiary before sending money to it`;
    case 'BENEFICIARY_EXISTS':
      return $localize`This account is already in your beneficiaries`;
    case 'BENEFICIARY_LIMIT':
      return $localize`You can save at most ${MAX_BENEFICIARIES_PER_USER}:max: beneficiaries`;
    case 'IDEMPOTENCY_KEY_REUSED':
      return $localize`This Idempotency-Key was already used for a different request`;
    default:
      return undefined;
  }
}
