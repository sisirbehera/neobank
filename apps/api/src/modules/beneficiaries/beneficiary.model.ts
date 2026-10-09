import { HydratedDocument, model, Schema, Types } from 'mongoose';
import type { BeneficiaryDto } from '@neobank/shared/models';

/** A saved payee: someone else's account the user is allowed to send money to. */
export interface Beneficiary {
  userId: Types.ObjectId;
  name: string;
  accountNumber: string;
  nickname: string;
  createdAt: Date;
}

export type BeneficiaryDocument = HydratedDocument<Beneficiary>;

const beneficiarySchema = new Schema<Beneficiary>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true },
    nickname: { type: String, default: '', trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// A user can save each account number once.
beneficiarySchema.index({ userId: 1, accountNumber: 1 }, { unique: true });

export const BeneficiaryModel = model<Beneficiary>(
  'Beneficiary',
  beneficiarySchema,
);

export function toBeneficiaryDto(b: BeneficiaryDocument): BeneficiaryDto {
  return {
    id: b.id,
    name: b.name,
    accountNumber: b.accountNumber,
    nickname: b.nickname,
    createdAt: b.createdAt.toISOString(),
  };
}
