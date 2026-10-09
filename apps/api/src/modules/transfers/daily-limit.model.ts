import { model, Schema, Types } from 'mongoose';

/** How much a user has sent to other people on one calendar day (IST). */
export interface DailyTransferUsage {
  userId: Types.ObjectId;
  /** "YYYY-MM-DD" in Asia/Kolkata. */
  day: string;
  usedPaise: number;
  expiresAt: Date;
}

const dailyTransferUsageSchema = new Schema<DailyTransferUsage>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  day: { type: String, required: true },
  usedPaise: { type: Number, default: 0 },
  // Old counters are removed automatically.
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

dailyTransferUsageSchema.index({ userId: 1, day: 1 }, { unique: true });

export const DailyTransferUsageModel = model<DailyTransferUsage>(
  'DailyTransferUsage',
  dailyTransferUsageSchema,
);
