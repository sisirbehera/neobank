import type { RequestHandler } from 'express';
import type { UserRole } from '@neobank/shared/models';
import { HttpError } from '../lib/http-error';
import { verifyAccessToken } from '../modules/auth/tokens';

/** Requires `Authorization: Bearer <access token>` and sets `req.auth`. */
export function requireAuth(accessTokenSecret: string): RequestHandler {
  return (req, _res, next) => {
    const header = req.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const claims = token ? verifyAccessToken(token, accessTokenSecret) : null;

    if (!claims) return next(HttpError.unauthorized());

    req.auth = { userId: claims.sub, role: claims.role };
    next();
  };
}

/** Use after requireAuth: `router.get('/x', requireAuth(s), requireRole('admin'), ...)`. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (req.auth && roles.includes(req.auth.role)) return next();
    next(HttpError.forbidden());
  };
}
