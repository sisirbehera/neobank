import { createHash } from 'node:crypto';
import mongoose, { type ClientSession } from 'mongoose';
import { HttpError } from '../../lib/http-error';
import { isDuplicateKey } from '../../lib/mongo-errors';
import { IdempotencyRecordModel } from './idempotency-record.model';

export interface IdempotentOutcome<T> {
  result: T;
  /** True when this is a retry and `result` is the original response. */
  replayed: boolean;
}

interface IdempotencyOptions {
  userId: string;
  key: string;
  scope: string;
  /** The validated request body; hashed to detect key reuse. */
  request: unknown;
}

/**
 * Runs `work` inside a MongoDB transaction at most once per (user, key).
 *
 * The idempotency record is written in the SAME transaction as the money
 * movement, so they commit together: there is never a transfer without a
 * record, or a record without a transfer. If two identical requests race,
 * the unique index lets only one commit; the other replays its result.
 */
export async function runIdempotent<T>(
  { userId, key, scope, request }: IdempotencyOptions,
  work: (session: ClientSession) => Promise<T>,
): Promise<IdempotentOutcome<T>> {
  const requestHash = createHash('sha256')
    .update(scope)
    .update(JSON.stringify(request))
    .digest('hex');

  const replay = async (): Promise<IdempotentOutcome<T> | null> => {
    const record = await IdempotencyRecordModel.findOne({ userId, key });
    if (!record) return null;
    if (record.requestHash !== requestHash) {
      throw new HttpError(
        422,
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used for a different request',
      );
    }
    return { result: record.response as T, replayed: true };
  };

  const previous = await replay();
  if (previous) return previous;

  try {
    const result = await mongoose.connection.transaction(async (session) => {
      // Claim the key first, so a racing duplicate conflicts immediately.
      await IdempotencyRecordModel.create(
        [{ userId, key, scope, requestHash }],
        { session },
      );
      const result = await work(session);
      await IdempotencyRecordModel.updateOne(
        { userId, key },
        { $set: { response: result } },
        { session },
      );
      return result;
    });
    return { result, replayed: false };
  } catch (err) {
    if (isDuplicateKey(err, 'key')) {
      const winner = await replay();
      if (winner) return winner;
    }
    throw err;
  }
}
