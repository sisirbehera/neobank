import type { RequestHandler } from 'express';
import { HttpError } from '../../lib/http-error';
import { userId } from '../../lib/request';
import { UserModel } from './user.model';

/**
 * Demo accounts are one login shared by every visitor of the public demo.
 * Anything that would lock the others out, or show them each other's
 * devices, is refused or narrowed:
 *  - changing the password, turning on 2FA, signing out other devices → 403
 *  - the devices list shows only the caller's own session
 *  - wrong passwords never lock the account (the per-IP rate limit still applies)
 */
export async function isDemoAccount(userId: unknown): Promise<boolean> {
  return !!(await UserModel.exists({ _id: userId, demo: true }));
}

/** Route guard: 403 DEMO_ACCOUNT for the shared demo logins. */
export const refuseDemoAccount: RequestHandler = async (req, _res, next) => {
  if (await isDemoAccount(userId(req))) {
    throw new HttpError(
      403,
      'DEMO_ACCOUNT',
      "This is the shared demo account, so its security settings can't be changed. Register your own account to try them.",
    );
  }
  next();
};
