import {
  Router,
  type CookieOptions,
  type Request,
  type Response,
} from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  LoginRequestSchema,
  MfaEnrollConfirmRequestSchema,
  MfaTokenRequestSchema,
  MfaVerifyRequestSchema,
  RegisterRequestSchema,
  type AuthResponse,
  type EnrollConfirmResponse,
} from '@neobank/shared/models';
import type { AuthConfig } from '../../config/app-config';
import { HttpError } from '../../lib/http-error';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { AuthService, type ClientMeta, type Session } from './auth.service';

export const REFRESH_COOKIE = 'nb_rt';
/**
 * Companion cookie with no secret in it, readable by JavaScript: "a session
 * probably exists". Signed-out visitors don't have it, so the app skips the
 * /refresh round trip (and its 401) on their first page load.
 */
export const SESSION_HINT_COOKIE = 'nb_session';

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

  const hintOptions: CookieOptions = {
    httpOnly: false,
    secure: config.secureCookies,
    sameSite: 'strict',
    path: '/',
  };

  const setSessionCookies = (res: Response, refreshToken: string) => {
    const maxAge = config.refreshTokenTtlDays * 86_400_000;
    res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, maxAge });
    res.cookie(SESSION_HINT_COOKIE, '1', { ...hintOptions, maxAge });
  };

  const clearSessionCookies = (res: Response) => {
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.clearCookie(SESSION_HINT_COOKIE, hintOptions);
  };

  const sendSession = (res: Response, session: Session, status = 200) => {
    setSessionCookies(res, session.refreshToken);
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
      const result = await auth.login(req.body, meta(req));
      // A 2FA challenge has no session yet: no cookie, just the challenge.
      if ('mfaRequired' in result) res.json(result);
      else sendSession(res, result);
    },
  );

  // ---- Second step of signing in ----------------------------------------------

  router.post(
    '/mfa/verify',
    credentialsLimiter,
    validateBody(MfaVerifyRequestSchema),
    async (req, res) => {
      sendSession(
        res,
        await auth.verifyMfa(req.body.mfaToken, req.body.code, meta(req)),
      );
    },
  );

  router.post(
    '/mfa/enroll/start',
    credentialsLimiter,
    validateBody(MfaTokenRequestSchema),
    async (req, res) => {
      res.json(await auth.enrollStart(req.body.mfaToken));
    },
  );

  router.post(
    '/mfa/enroll/confirm',
    credentialsLimiter,
    validateBody(MfaEnrollConfirmRequestSchema),
    async (req, res) => {
      const { session, backupCodes } = await auth.enrollConfirm(
        req.body.mfaToken,
        req.body.code,
        meta(req),
      );
      setSessionCookies(res, session.refreshToken);
      const body: EnrollConfirmResponse = {
        accessToken: session.accessToken,
        user: session.user,
        backupCodes,
      };
      res.json(body);
    },
  );

  router.post('/refresh', refreshLimiter, async (req, res) => {
    try {
      sendSession(
        res,
        await auth.refresh(req.cookies[REFRESH_COOKIE], meta(req)),
      );
    } catch (err) {
      clearSessionCookies(res);
      throw err;
    }
  });

  router.post('/logout', async (req, res) => {
    await auth.logout(req.cookies[REFRESH_COOKIE]);
    clearSessionCookies(res);
    res.status(204).end();
  });

  router.get('/me', requireAuth(config.accessTokenSecret), async (req, res) => {
    if (!req.auth) throw HttpError.unauthorized();
    res.json(await auth.getUser(req.auth.userId));
  });

  return router;
}
