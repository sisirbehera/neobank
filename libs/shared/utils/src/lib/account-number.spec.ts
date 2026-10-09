import {
  buildAccountNumber,
  formatAccountNumber,
  isValidAccountNumber,
  luhnCheckDigit,
  maskAccountNumber,
} from './account-number';

describe('account numbers', () => {
  it('computes the standard Luhn check digit', () => {
    // Classic example: 7992739871 → check digit 3
    expect(luhnCheckDigit('7992739871')).toBe(3);
  });

  it('builds numbers that validate', () => {
    const number = buildAccountNumber('123456789');
    expect(number).toMatch(/^NB\d{10}$/);
    expect(isValidAccountNumber(number)).toBe(true);
  });

  it('catches a single mistyped digit', () => {
    const number = buildAccountNumber('123456789');
    const typo = number.replace('NB1', 'NB2');
    expect(isValidAccountNumber(typo)).toBe(false);
  });

  it('catches two swapped digits', () => {
    const number = buildAccountNumber('123456789');
    const swapped = `NB21${number.slice(4)}`;
    expect(isValidAccountNumber(swapped)).toBe(false);
  });

  it('accepts spaces and lower case', () => {
    const number = buildAccountNumber('555000111');
    expect(
      isValidAccountNumber(formatAccountNumber(number).toLowerCase()),
    ).toBe(true);
  });

  it('formats and masks for display', () => {
    expect(formatAccountNumber('NB1234567897')).toBe('NB12 3456 7897');
    expect(maskAccountNumber('NB1234567897')).toBe('•••• 7897');
  });
});
