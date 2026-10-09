import { z } from 'zod';
import { isValidAccountNumber } from '@neobank/shared/utils';
import {
  AccountDtoSchema,
  DescriptionSchema,
  LedgerEntryDtoSchema,
} from './accounts';
import { NameSchema } from './auth';
import { MovementAmountSchema } from './money';

/** Transfers to other people's accounts, per user per calendar day (IST): ₹2,00,000. */
export const DAILY_EXTERNAL_TRANSFER_LIMIT_PAISE = 2_00_000_00;

export const MAX_BENEFICIARIES_PER_USER = 20;

/**
 * Header that makes a money-moving request safe to retry. Send a new random
 * value (e.g. crypto.randomUUID()) per user action and reuse it on retries.
 */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const IdempotencyKeySchema = z
  .string()
  .regex(
    /^[A-Za-z0-9_-]{8,100}$/,
    'Idempotency-Key must be 8–100 letters, digits, - or _',
  );

/** Accepts "nb12 3456 7897" style input; outputs "NB1234567897" if the check digit is right. */
export const AccountNumberInputSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, '').toUpperCase())
  .pipe(
    z
      .string()
      .min(1, 'Account number is required')
      .refine(
        isValidAccountNumber,
        'This account number is not valid. Check it for typos.',
      ),
  );

// ---- Beneficiaries ----------------------------------------------------------

export const AddBeneficiaryRequestSchema = z.object({
  name: NameSchema,
  accountNumber: AccountNumberInputSchema,
  nickname: z
    .string()
    .trim()
    .max(30, 'Nickname must be at most 30 characters')
    .default(''),
});
export type AddBeneficiaryRequest = z.input<typeof AddBeneficiaryRequestSchema>;

export const BeneficiaryDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountNumber: z.string(),
  nickname: z.string(),
  createdAt: z.iso.datetime(),
});
export type BeneficiaryDto = z.infer<typeof BeneficiaryDtoSchema>;

// ---- Transfers --------------------------------------------------------------

export const TransferRequestSchema = z.object({
  fromAccountId: z.string().min(1, 'Choose the account to pay from'),
  /** One of your own accounts, or a saved beneficiary's account. */
  toAccountNumber: AccountNumberInputSchema,
  amountPaise: MovementAmountSchema,
  description: DescriptionSchema.default(''),
});
export type TransferRequest = z.input<typeof TransferRequestSchema>;

export const TransferResponseSchema = z.object({
  transactionId: z.string(),
  /** The paying account after the transfer. */
  fromAccount: AccountDtoSchema,
  /** The debit line on the paying account's statement. */
  entry: LedgerEntryDtoSchema,
});
export type TransferResponse = z.infer<typeof TransferResponseSchema>;
