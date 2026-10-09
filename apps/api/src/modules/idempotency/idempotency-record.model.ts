import { model, Schema, Types } from 'mongoose';

/**
 * Remembers the result of a money-moving request by (user, Idempotency-Key),
 * so a retry returns the original result instead of moving money again.
 */
export interface IdempotencyRecord {
  userId: Types.ObjectId;
  key: string;
  /** Which operation the key was used for, e.g. "TRANSFER". */
  scope: string;
  /** SHA-256 of scope + request body: the same key can't be reused for a different request. */
  requestHash: string;
  response: unknown;
  createdAt: Date;
}

const idempotencyRecordSchema = new Schema<IdempotencyRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    scope: { type: String, required: true },
    requestHash: { type: String, required: true },
    response: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

idempotencyRecordSchema.index({ userId: 1, key: 1 }, { unique: true });
// Keys only need to be remembered long enough to cover retries.
idempotencyRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86_400 });

export const IdempotencyRecordModel = model<IdempotencyRecord>(
  'IdempotencyRecord',
  idempotencyRecordSchema,
);
