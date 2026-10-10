import type { ChangePasswordRequest, SessionDto } from '@neobank/shared/models';
import { HttpError } from '../../lib/http-error';
import {
  assertNotLocked,
  clearFailedAttempts,
  recordFailedAttempt,
} from '../auth/lockout';
import { hashPassword, verifyPassword } from '../auth/password';
import { RefreshTokenModel } from '../auth/refresh-token.model';
import { isDemoAccount } from '../users/demo-account';
import { UserModel } from '../users/user.model';

/** Password changes and the "where am I signed in" list. */
export class SecurityService {
  /**
   * Changes the password and signs out every OTHER device. The current
   * session keeps working, so the user isn't kicked out of the page.
   */
  async changePassword(
    userId: string,
    currentSessionId: string,
    { currentPassword, newPassword }: ChangePasswordRequest,
  ): Promise<void> {
    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user) throw HttpError.unauthorized();
    assertNotLocked(user);

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      await recordFailedAttempt(user._id);
      const message = 'Current password is not correct';
      throw HttpError.badRequest(message, { currentPassword: [message] });
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await clearFailedAttempts(user._id);
    await this.revoke(userId, { sessionId: { $ne: currentSessionId } });
  }

  /** One row per signed-in device (the newest token of each session). */
  async sessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionDto[]> {
    // A shared demo login only sees its own session, not other visitors'.
    const onlyCurrent = await isDemoAccount(userId);
    const tokens = await RefreshTokenModel.find({
      userId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
      ...(onlyCurrent && { sessionId: currentSessionId }),
    }).sort({ createdAt: -1 });

    const seen = new Set<string>();
    return tokens
      .filter((t) => !seen.has(t.sessionId) && seen.add(t.sessionId))
      .map((t) => ({
        id: t.sessionId,
        userAgent: t.userAgent ?? '',
        ip: t.ip ?? '',
        startedAt: t.sessionStartedAt.toISOString(),
        // A new token is issued on every refresh, so its creation time is
        // when the device was last active.
        lastActiveAt: t.createdAt.toISOString(),
        current: t.sessionId === currentSessionId,
        mfa: t.mfa,
      }));
  }

  /** Signs out one device. Its access token still works for up to 15 minutes. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const revoked = await this.revoke(userId, { sessionId });
    if (revoked === 0) throw HttpError.notFound('Session not found');
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    await this.revoke(userId, { sessionId: { $ne: currentSessionId } });
  }

  private async revoke(
    userId: string,
    filter: { sessionId: string | { $ne: string } },
  ): Promise<number> {
    const { modifiedCount } = await RefreshTokenModel.updateMany(
      { userId, revokedAt: { $exists: false }, ...filter },
      { $set: { revokedAt: new Date() } },
    );
    return modifiedCount;
  }
}
