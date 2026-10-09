import { HydratedDocument, model, Schema, Types } from 'mongoose';
import type {
  AccountDto,
  AccountStatus,
  AccountType,
} from '@neobank/shared/models';

export interface Account {
  userId: Types.ObjectId;
  accountNumber: string;
  type: AccountType;
  nickname: string;
  currency: 'INR';
  /** Paise. Only ever changed with $inc inside a transaction, never by save(). */
  balance: number;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountDocument = HydratedDocument<Account>;

const accountSchema = new Schema<Account>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountNumber: { type: String, required: true, unique: true },
    type: { type: String, enum: ['SAVINGS', 'CURRENT'], required: true },
    nickname: { type: String, default: '', trim: true },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    balance: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Balance must be whole paise',
      },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'FROZEN', 'CLOSED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true },
);

export const AccountModel = model<Account>('Account', accountSchema);

export function toAccountDto(account: AccountDocument): AccountDto {
  return {
    id: account.id,
    accountNumber: account.accountNumber,
    type: account.type,
    nickname: account.nickname,
    currency: account.currency,
    balance: account.balance,
    status: account.status,
    createdAt: account.createdAt.toISOString(),
  };
}
