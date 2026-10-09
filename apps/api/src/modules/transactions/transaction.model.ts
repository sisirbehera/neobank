import { HydratedDocument, model, Schema, Types } from 'mongoose';
import type { TransactionType } from '@neobank/shared/models';

/**
 * A business event that moved money: "deposit ₹500", "transfer ₹200 A→B".
 * Its effect on each account is recorded as one LedgerEntry per account.
 */
export interface Transaction {
  type: TransactionType;
  /** Debited account (withdrawals, transfers). */
  fromAccountId?: Types.ObjectId;
  /** Credited account (deposits, transfers). */
  toAccountId?: Types.ObjectId;
  /** Paise, always positive. */
  amount: number;
  description: string;
  status: 'COMPLETED';
  initiatedBy: Types.ObjectId;
  /** Transfer to someone else's account (counts towards the daily limit). */
  isExternal: boolean;
  createdAt: Date;
}

export type TransactionDocument = HydratedDocument<Transaction>;

const transactionSchema = new Schema<Transaction>(
  {
    type: {
      type: String,
      enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'],
      required: true,
    },
    fromAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    toAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    amount: { type: Number, required: true, min: 1 },
    description: { type: String, default: '' },
    status: { type: String, enum: ['COMPLETED'], default: 'COMPLETED' },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isExternal: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const TransactionModel = model<Transaction>(
  'Transaction',
  transactionSchema,
);
