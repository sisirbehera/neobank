/**
 * Account numbers are "NB" + 9 random digits + 1 Luhn check digit.
 * The check digit catches most typos (one wrong digit, two swapped digits)
 * before a request ever reaches the server.
 */

const PREFIX = 'NB';

/** Luhn check digit for a string of digits. */
export function luhnCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // Double every second digit, starting from the right-most one.
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Builds an account number from 9 digits, e.g. "123456789" → "NB1234567897". */
export function buildAccountNumber(nineDigits: string): string {
  if (!/^\d{9}$/.test(nineDigits)) throw new Error('Expected 9 digits');
  return `${PREFIX}${nineDigits}${luhnCheckDigit(nineDigits)}`;
}

export function isValidAccountNumber(value: string): boolean {
  const match = /^NB(\d{9})(\d)$/.exec(value.replace(/\s/g, '').toUpperCase());
  return !!match && luhnCheckDigit(match[1]) === Number(match[2]);
}

/** "NB1234567897" → "NB12 3456 7897" */
export function formatAccountNumber(value: string): string {
  return value.replace(/^(NB\d{2})(\d{4})(\d{4})$/, '$1 $2 $3');
}

/** "NB1234567897" → "•••• 7897" */
export function maskAccountNumber(value: string): string {
  return `•••• ${value.slice(-4)}`;
}
