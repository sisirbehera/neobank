import { Router } from 'express';
import { TransferRequestSchema } from '@neobank/shared/models';
import { userId } from '../../lib/request';
import { requireAuth } from '../../middleware/auth';
import { idempotencyKey, sendIdempotent } from '../../middleware/idempotency';
import { validateBody } from '../../middleware/validate';
import { TransfersService } from './transfers.service';

export function transfersRoutes(accessTokenSecret: string): Router {
  const router = Router();
  const transfers = new TransfersService();

  router.use(requireAuth(accessTokenSecret));

  router.post('/', validateBody(TransferRequestSchema), async (req, res) => {
    const key = idempotencyKey(req);
    sendIdempotent(
      res,
      await transfers.transfer(userId(req), req.body, key),
      201,
    );
  });

  return router;
}
