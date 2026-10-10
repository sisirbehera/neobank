import { HttpError } from '../../lib/http-error';
import { type UserDocument, UserModel } from '../users/user.model';

/**
 * One lockout counter for everything that guesses a secret: passwords at
 * login, 2FA codes, and step-up codes. 5 wrong answers → locked 15 minutes.
 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export function assertNotLocked(user: UserDocument): void {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60_000,
    );
    throw new HttpError(
      423,
      'ACCOUNT_LOCKED',
      `Too many failed attempts. Try again in ${minutes} minute(s).`,
    );
  }
}

export async function recordFailedAttempt(userId: unknown): Promise<void> {
  // $inc is atomic, so parallel guesses can't slip past the limit.
  // Shared demo logins are never locked: anyone could lock out every visitor.
  const updated = await UserModel.findOneAndUpdate(
    { _id: userId, demo: { $ne: true } },
    { $inc: { failedLoginCount: 1 } },
    { returnDocument: 'after' },
  );
  if (updated && updated.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          failedLoginCount: 0,
          lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
        },
      },
    );
  }
}

export async function clearFailedAttempts(userId: unknown): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    { $set: { failedLoginCount: 0 }, $unset: { lockedUntil: '' } },
  );
}
