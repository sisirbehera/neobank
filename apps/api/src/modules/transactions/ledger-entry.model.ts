import { HydratedDocument, model, Schema, Types } from 'mongoose';
import type {
  LedgerDirection,
  LedgerEntryDto,
  TransactionType,
} from '@neobank/shared/models';

/**
 * Append-only record of every change to an account balance. Entries are never
 * updated or deleted, so an account's balance can always be rebuilt from them:
 *   balance = Σ CREDIT − Σ DEBIT
 */
export interface LedgerEntry {
  transactionId: Types.ObjectId;
  accountId: Types.ObjectId;
  /** Copied from the transaction so statements need no join. */
  type: TransactionType;
  direction: LedgerDirection;
  /** Paise, always positive. */
  amount: number;
  /** Account balance right after this entry, in paise. */
  balanceAfter: number;
  description: string;
  /** Other side of a transfer, e.g. "Asha Rao · •••• 7897". */
  counterparty: string;
  createdAt: Date;
}

export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;

const ledgerEntrySchema = new Schema<LedgerEntry>(
  {
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    type: {
      type: String,
      enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'],
      required: true,
    },
    direction: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    amount: { type: Number, required: true, min: 1 },
    balanceAfter: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    counterparty: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Statement queries: newest entries of one account first.
ledgerEntrySchema.index({ accountId: 1, createdAt: -1, _id: -1 });

export const LedgerEntryModel = model<LedgerEntry>(
  'LedgerEntry',
  ledgerEntrySchema,
);

export function toLedgerEntryDto(entry: LedgerEntryDocument): LedgerEntryDto {
  return {
    id: entry.id,
    transactionId: entry.transactionId.toString(),
    accountId: entry.accountId.toString(),
    type: entry.type,
    direction: entry.direction,
    amount: entry.amount,
    balanceAfter: entry.balanceAfter,
    description: entry.description,
    counterparty: entry.counterparty ?? '',
    createdAt: entry.createdAt.toISOString(),
  };
}
