import type { ClientSession } from 'mongoose';
import { DAILY_EXTERNAL_TRANSFER_LIMIT_PAISE } from '@neobank/shared/models';
import { formatInr } from '@neobank/shared/utils';
import { HttpError } from '../../lib/http-error';
import { isDuplicateKey } from '../../lib/mongo-errors';
import { DailyTransferUsageModel } from './daily-limit.model';

const istDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * Adds `amount` to today's usage, or throws if that would exceed the limit.
 *
 * One atomic upsert does both the check and the increment:
 *  - the filter only matches today's counter if there is room left;
 *  - if there is no counter yet, the upsert creates it;
 *  - if a counter exists but is too full, the upsert tries to insert a second
 *    one for the same day, the unique index rejects it, and we know the limit
 *    is reached. Two parallel transfers can't both squeeze under the limit.
 */
export async function consumeDailyLimit(
  session: ClientSession,
  userId: string,
  amount: number,
): Promise<void> {
  const limit = DAILY_EXTERNAL_TRANSFER_LIMIT_PAISE;
  try {
    await DailyTransferUsageModel.updateOne(
      {
        userId,
        day: istDay.format(new Date()),
        usedPaise: { $lte: limit - amount },
      },
      {
        $inc: { usedPaise: amount },
        $setOnInsert: { expiresAt: new Date(Date.now() + 3 * 86_400_000) },
      },
      { upsert: true, session },
    );
  } catch (err) {
    if (isDuplicateKey(err)) {
      throw new HttpError(
        422,
        'DAILY_LIMIT_EXCEEDED',
        `This would exceed your daily limit of ${formatInr(limit)} for transfers to others`,
      );
    }
    throw err;
  }
}
