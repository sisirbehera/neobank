import * as z from 'zod/mini';

// Shared schemas use `zod/mini`: the same validation as `zod`, but written as
// functions (z.optional(s), s.check(z.minLength(2))) so bundlers can drop
// what isn't used. In the browser that's ~8 KB gzipped instead of ~90 KB.

/**
 * All money is stored and transferred as an integer number of paise
 * (₹1 = 100 paise). Never use floating point rupees for balances.
 */
export const PaiseSchema = z
  .int('Amount must be a whole number of paise')
  .check(z.nonnegative('Amount cannot be negative'));

export const PositivePaiseSchema = PaiseSchema.check(
  z.positive('Amount must be greater than zero'),
);

export type Paise = z.infer<typeof PaiseSchema>;

export const CURRENCY = 'INR' as const;

/** Largest single deposit or withdrawal in this demo: ₹1,00,000. */
export const MAX_MOVEMENT_PAISE = 1_00_000_00;

/** One deposit/withdrawal amount, in paise. */
export const MovementAmountSchema = PositivePaiseSchema.check(
  z.maximum(MAX_MOVEMENT_PAISE, 'Amount cannot exceed ₹1,00,000'),
);

/**
 * Parses what a user types into an amount box ("1500", "1,500.50") into paise.
 * The string is parsed digit by digit, so there is no floating point rounding.
 */
export const RupeeInputSchema = z.pipe(
  z.pipe(
    z.pipe(
      z.string().check(z.trim()),
      z.transform((value: string) => value.replace(/,/g, '')),
    ),
    z
      .string()
      .check(
        z.regex(
          /^\d{1,9}(\.\d{1,2})?$/,
          'Enter an amount like 1500 or 1500.50',
        ),
      ),
  ),
  z.pipe(
    z.transform((value: string) => {
      const [rupees, paise = ''] = value.split('.');
      return Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
    }),
    MovementAmountSchema,
  ),
);
