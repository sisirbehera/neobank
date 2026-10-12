import { type Request, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  type BackupCodesResponse,
  ChangePasswordRequestSchema,
  MfaDisableRequestSchema,
  MfaEnableRequestSchema,
  StepUpRequestSchema,
} from '@neobank/shared/models';
import type { AuthConfig } from '../../config/app-config';
import { HttpError } from '../../lib/http-error';
import { param, userId } from '../../lib/request';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { refuseDemoAccount } from '../users/demo-account';
import { MfaService } from './mfa.service';
import { type EventContext, listSecurityEvents } from './security-events';
import { SecurityService } from './security.service';

function sessionId(req: Request): string {
  if (!req.auth) throw HttpError.unauthorized();
  return req.auth.sessionId;
}

/** Device and session of the request, for the activity list. */
function eventContext(req: Request): EventContext & { sessionId: string } {
  return {
    sessionId: sessionId(req),
    userAgent: req.get('user-agent')?.slice(0, 200),
    ip: req.ip,
  };
}

/** /api/security: two-step verification, step-up codes, password, sessions. */
export function securityRoutes(config: AuthConfig): Router {
  const router = Router();
  const mfa = new MfaService({
    encryptionKey: config.mfaEncryptionKey,
    tokenSecret: config.accessTokenSecret,
  });
  const security = new SecurityService();

  // Everything here checks a secret (code or password): slow down guessing.
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimit * 2,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new HttpError(
          429,
          'TOO_MANY_REQUESTS',
          'Too many attempts. Please wait a few minutes.',
        ),
      ),
  });

  router.use(requireAuth(config.accessTokenSecret));

  // ---- Two-step verification ---------------------------------------------------

  router.post('/mfa/setup', refuseDemoAccount, async (req, res) => {
    res.json(await mfa.startSetup(userId(req)));
  });

  router.post(
    '/mfa/enable',
    limiter,
    refuseDemoAccount,
    validateBody(MfaEnableRequestSchema),
    async (req, res) => {
      const body: BackupCodesResponse = {
        backupCodes: await mfa.confirmSetup(
          userId(req),
          req.body.code,
          eventContext(req),
        ),
      };
      res.json(body);
    },
  );

  router.post(
    '/mfa/disable',
    limiter,
    validateBody(MfaDisableRequestSchema),
    async (req, res) => {
      await mfa.disable(
        userId(req),
        req.body.password,
        req.body.code,
        eventContext(req),
      );
      res.status(204).end();
    },
  );

  router.post(
    '/mfa/backup-codes',
    limiter,
    validateBody(MfaEnableRequestSchema),
    async (req, res) => {
      const body: BackupCodesResponse = {
        backupCodes: await mfa.regenerateBackupCodes(
          userId(req),
          req.body.code,
          eventContext(req),
        ),
      };
      res.json(body);
    },
  );

  /** A fresh code → a 5-minute token for one risky action (see STEP_UP_HEADER). */
  router.post(
    '/step-up',
    limiter,
    validateBody(StepUpRequestSchema),
    async (req, res) => {
      res.json(await mfa.stepUp(userId(req), req.body.action, req.body.code));
    },
  );

  // ---- Password & sessions -------------------------------------------------------

  router.post(
    '/password',
    limiter,
    refuseDemoAccount,
    validateBody(ChangePasswordRequestSchema),
    async (req, res) => {
      await security.changePassword(userId(req), eventContext(req), req.body);
      res.status(204).end();
    },
  );

  router.get('/sessions', async (req, res) => {
    res.json(await security.sessions(userId(req), sessionId(req)));
  });

  router.post(
    '/sessions/revoke-others',
    refuseDemoAccount,
    async (req, res) => {
      await security.revokeOtherSessions(userId(req), eventContext(req));
      res.status(204).end();
    },
  );

  router.delete('/sessions/:id', refuseDemoAccount, async (req, res) => {
    await security.revokeSession(
      userId(req),
      param(req, 'id'),
      eventContext(req),
    );
    res.status(204).end();
  });

  router.get('/activity', async (req, res) => {
    res.json(await listSecurityEvents(userId(req), sessionId(req)));
  });

  return router;
}
