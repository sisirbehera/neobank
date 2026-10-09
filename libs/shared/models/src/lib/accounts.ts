import { z } from 'zod';
import { CURRENCY, MovementAmountSchema, PaiseSchema } from './money';

export const AccountTypeSchema = z.enum(['SAVINGS', 'CURRENT']);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const AccountStatusSchema = z.enum(['ACTIVE', 'FROZEN', 'CLOSED']);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

/** "NB" + 10 digits; the last digit is a Luhn check digit. */
export const AccountNumberSchema = z
  .string()
  .regex(/^NB\d{10}$/, 'Account numbers look like NB1234567890');

export const MAX_ACCOUNTS_PER_USER = 5;

export const AccountDtoSchema = z.object({
  id: z.string(),
  accountNumber: AccountNumberSchema,
  type: AccountTypeSchema,
  nickname: z.string(),
  currency: z.literal(CURRENCY),
  /** Paise. */
  balance: PaiseSchema,
  status: AccountStatusSchema,
  createdAt: z.iso.datetime(),
});
export type AccountDto = z.infer<typeof AccountDtoSchema>;

export const OpenAccountRequestSchema = z.object({
  type: AccountTypeSchema,
  nickname: z
    .string()
    .trim()
    .max(30, 'Nickname must be at most 30 characters')
    .default(''),
});
export type OpenAccountRequest = z.input<typeof OpenAccountRequestSchema>;

// ---- Money movement ---------------------------------------------------------

export const TransactionTypeSchema = z.enum([
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER',
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const LedgerDirectionSchema = z.enum(['CREDIT', 'DEBIT']);
export type LedgerDirection = z.infer<typeof LedgerDirectionSchema>;

export const DescriptionSchema = z
  .string()
  .trim()
  .max(100, 'Description must be at most 100 characters');

export const MoneyMovementRequestSchema = z.object({
  amountPaise: MovementAmountSchema,
  description: DescriptionSchema.default(''),
});
export type MoneyMovementRequest = z.input<typeof MoneyMovementRequestSchema>;

/** One line on an account statement. */
export const LedgerEntryDtoSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  accountId: z.string(),
  type: TransactionTypeSchema,
  direction: LedgerDirectionSchema,
  /** Paise, always positive; direction says which way it moved. */
  amount: PaiseSchema,
  balanceAfter: PaiseSchema,
  description: z.string(),
  createdAt: z.iso.datetime(),
});
export type LedgerEntryDto = z.infer<typeof LedgerEntryDtoSchema>;

export const MoneyMovementResponseSchema = z.object({
  account: AccountDtoSchema,
  entry: LedgerEntryDtoSchema,
});
export type MoneyMovementResponse = z.infer<typeof MoneyMovementResponseSchema>;
