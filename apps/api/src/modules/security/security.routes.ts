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
import { MfaService } from './mfa.service';
import { SecurityService } from './security.service';

function sessionId(req: Request): string {
  if (!req.auth) throw HttpError.unauthorized();
  return req.auth.sessionId;
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

  router.post('/mfa/setup', async (req, res) => {
    res.json(await mfa.startSetup(userId(req)));
  });

  router.post(
    '/mfa/enable',
    limiter,
    validateBody(MfaEnableRequestSchema),
    async (req, res) => {
      const body: BackupCodesResponse = {
        backupCodes: await mfa.confirmSetup(userId(req), req.body.code),
      };
      res.json(body);
    },
  );

  router.post(
    '/mfa/disable',
    limiter,
    validateBody(MfaDisableRequestSchema),
    async (req, res) => {
      await mfa.disable(userId(req), req.body.password, req.body.code);
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
    validateBody(ChangePasswordRequestSchema),
    async (req, res) => {
      await security.changePassword(userId(req), sessionId(req), req.body);
      res.status(204).end();
    },
  );

  router.get('/sessions', async (req, res) => {
    res.json(await security.sessions(userId(req), sessionId(req)));
  });

  router.post('/sessions/revoke-others', async (req, res) => {
    await security.revokeOtherSessions(userId(req), sessionId(req));
    res.status(204).end();
  });

  router.delete('/sessions/:id', async (req, res) => {
    await security.revokeSession(userId(req), param(req, 'id'));
    res.status(204).end();
  });

  return router;
}
