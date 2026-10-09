import type { Request, Response } from 'express';
import {
  IDEMPOTENCY_HEADER,
  IdempotencyKeySchema,
} from '@neobank/shared/models';
import { HttpError } from '../lib/http-error';
import type { IdempotentOutcome } from '../modules/idempotency/idempotency';

/** Reads and validates the required Idempotency-Key header. */
export function idempotencyKey(req: Request): string {
  const value = req.get(IDEMPOTENCY_HEADER);
  if (!value) {
    throw HttpError.badRequest(`The ${IDEMPOTENCY_HEADER} header is required`);
  }
  const result = IdempotencyKeySchema.safeParse(value);
  if (!result.success)
    throw HttpError.badRequest(result.error.issues[0].message);
  return result.data;
}

/** Sends the result; replays are marked with `Idempotent-Replayed: true`. */
export function sendIdempotent<T>(
  res: Response,
  { result, replayed }: IdempotentOutcome<T>,
  status = 200,
): void {
  if (replayed) res.set('Idempotent-Replayed', 'true');
  res.status(status).json(result);
}
