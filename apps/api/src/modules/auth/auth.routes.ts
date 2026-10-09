import {
  Router,
  type CookieOptions,
  type Request,
  type Response,
} from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  type AuthResponse,
} from '@neobank/shared/models';
import type { AuthConfig } from '../../config/app-config';
import { HttpError } from '../../lib/http-error';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { AuthService, type ClientMeta, type Session } from './auth.service';

export const REFRESH_COOKIE = 'nb_rt';

export function authRoutes(config: AuthConfig): Router {
  const router = Router();
  const auth = new AuthService(config);

  const cookieOptions: CookieOptions = {
    httpOnly: true, // JavaScript can't read it, so XSS can't steal it
    secure: config.secureCookies, // HTTPS only in production
    sameSite: 'strict', // never sent on cross-site requests (CSRF protection)
    path: '/api/auth', // only sent to the auth endpoints
  };

  const limiter = (limit: number) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(
          new HttpError(
            429,
            'TOO_MANY_REQUESTS',
            'Too many attempts. Please wait a few minutes and try again.',
          ),
        ),
    });
  // Strict for endpoints that check passwords (slows down guessing)...
  const credentialsLimiter = limiter(config.rateLimit);
  // ...generous for refresh, which every page load calls (users behind one
  // shared IP, e.g. an office network, must not be logged out).
  const refreshLimiter = limiter(config.rateLimit * 10);

  const meta = (req: Request): ClientMeta => ({
    userAgent: req.get('user-agent')?.slice(0, 200),
    ip: req.ip,
  });

  const sendSession = (res: Response, session: Session, status = 200) => {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...cookieOptions,
      maxAge: config.refreshTokenTtlDays * 86_400_000,
    });
    const body: AuthResponse = {
      accessToken: session.accessToken,
      user: session.user,
    };
    res.status(status).json(body);
  };

  router.post(
    '/register',
    credentialsLimiter,
    validateBody(RegisterRequestSchema),
    async (req, res) => {
      sendSession(res, await auth.register(req.body, meta(req)), 201);
    },
  );

  router.post(
    '/login',
    credentialsLimiter,
    validateBody(LoginRequestSchema),
    async (req, res) => {
      sendSession(res, await auth.login(req.body, meta(req)));
    },
  );

  router.post('/refresh', refreshLimiter, async (req, res) => {
    try {
      sendSession(
        res,
        await auth.refresh(req.cookies[REFRESH_COOKIE], meta(req)),
      );
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      throw err;
    }
  });

  router.post('/logout', async (req, res) => {
    await auth.logout(req.cookies[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.get('/me', requireAuth(config.accessTokenSecret), async (req, res) => {
    if (!req.auth) throw HttpError.unauthorized();
    res.json(await auth.getUser(req.auth.userId));
  });

  return router;
}
