import { buildAccountNumber } from '@neobank/shared/utils';
import {
  AddBeneficiaryRequestSchema,
  IdempotencyKeySchema,
  TransferRequestSchema,
} from './transfers';

const valid = buildAccountNumber('123456789');

describe('TransferRequestSchema', () => {
  it('normalises the account number', () => {
    const spaced = `${valid.slice(0, 4)} ${valid.slice(4, 8)} ${valid.slice(8)}`;
    const parsed = TransferRequestSchema.parse({
      fromAccountId: 'abc',
      toAccountNumber: spaced.toLowerCase(),
      amountPaise: 100,
    });
    expect(parsed.toAccountNumber).toBe(valid);
    expect(parsed.description).toBe('');
  });

  it('rejects an account number with a wrong check digit', () => {
    const typo = valid.slice(0, -1) + ((Number(valid.at(-1)) + 1) % 10);
    const result = TransferRequestSchema.safeParse({
      fromAccountId: 'abc',
      toAccountNumber: typo,
      amountPaise: 100,
    });
    expect(result.error?.issues[0].message).toContain('not valid');
  });
});

describe('AddBeneficiaryRequestSchema', () => {
  it('requires a name', () => {
    const result = AddBeneficiaryRequestSchema.safeParse({
      name: '',
      accountNumber: valid,
    });
    expect(result.error?.issues[0].path).toEqual(['name']);
  });
});

describe('IdempotencyKeySchema', () => {
  it.each([
    [crypto.randomUUID(), true],
    ['short', false],
    ['has spaces in it', false],
  ])('%s → %s', (key, ok) => {
    expect(IdempotencyKeySchema.safeParse(key).success).toBe(ok);
  });
});
