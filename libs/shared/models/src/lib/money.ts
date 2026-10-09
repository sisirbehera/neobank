import { z } from 'zod';

/**
 * All money is stored and transferred as an integer number of paise
 * (₹1 = 100 paise). Never use floating point rupees for balances.
 */
export const PaiseSchema = z
  .number()
  .int('Amount must be a whole number of paise')
  .nonnegative('Amount cannot be negative');

export const PositivePaiseSchema = PaiseSchema.positive(
  'Amount must be greater than zero',
);

export type Paise = z.infer<typeof PaiseSchema>;

export const CURRENCY = 'INR' as const;
