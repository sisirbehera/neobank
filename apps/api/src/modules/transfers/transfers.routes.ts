import { Router } from 'express';
import { STEP_UP_HEADER, TransferRequestSchema } from '@neobank/shared/models';
import type { AuthConfig } from '../../config/app-config';
import { MfaService } from '../security/mfa.service';
import { userId } from '../../lib/request';
import { requireAuth } from '../../middleware/auth';
import { idempotencyKey, sendIdempotent } from '../../middleware/idempotency';
import { validateBody } from '../../middleware/validate';
import { TransfersService } from './transfers.service';

export function transfersRoutes(config: AuthConfig): Router {
  const router = Router();
  const transfers = new TransfersService(
    new MfaService({
      encryptionKey: config.mfaEncryptionKey,
      tokenSecret: config.accessTokenSecret,
    }),
  );

  router.use(requireAuth(config.accessTokenSecret));

  router.post('/', validateBody(TransferRequestSchema), async (req, res) => {
    const key = idempotencyKey(req);
    sendIdempotent(
      res,
      await transfers.transfer(
        userId(req),
        req.body,
        key,
        req.get(STEP_UP_HEADER),
      ),
      201,
    );
  });

  return router;
}
