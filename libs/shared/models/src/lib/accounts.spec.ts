import {
  MoneyMovementRequestSchema,
  OpenAccountRequestSchema,
} from './accounts';
import { RupeeInputSchema } from './money';

describe('RupeeInputSchema', () => {
  it.each([
    ['1500', 150000],
    ['1,500.5', 150050],
    ['0.10', 10],
    [' 99999.99 ', 9999999],
    ['100000', 10000000],
  ])('parses %j to %i paise', (input, paise) => {
    expect(RupeeInputSchema.parse(input)).toBe(paise);
  });

  it.each([
    ['', 'Enter an amount'],
    ['abc', 'Enter an amount'],
    ['1.234', 'Enter an amount'],
    ['-5', 'Enter an amount'],
    ['0', 'greater than zero'],
    ['100000.01', 'cannot exceed'],
  ])('rejects %j', (input, message) => {
    const result = RupeeInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain(message);
  });
});

describe('account request schemas', () => {
  it('defaults the nickname to empty', () => {
    expect(OpenAccountRequestSchema.parse({ type: 'SAVINGS' })).toEqual({
      type: 'SAVINGS',
      nickname: '',
    });
  });

  it('rejects unknown account types', () => {
    expect(OpenAccountRequestSchema.safeParse({ type: 'GOLD' }).success).toBe(
      false,
    );
  });

  it('rejects fractional paise', () => {
    expect(
      MoneyMovementRequestSchema.safeParse({ amountPaise: 10.5 }).success,
    ).toBe(false);
  });
});
