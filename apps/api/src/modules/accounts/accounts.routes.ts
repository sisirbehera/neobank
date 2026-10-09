import { type Request, Router } from 'express';
import { z } from 'zod';
import {
  MoneyMovementRequestSchema,
  OpenAccountRequestSchema,
} from '@neobank/shared/models';
import { HttpError } from '../../lib/http-error';
import { param, userId } from '../../lib/request';
import { requireAuth } from '../../middleware/auth';
import { idempotencyKey, sendIdempotent } from '../../middleware/idempotency';
import { validateBody } from '../../middleware/validate';
import { AccountsService } from './accounts.service';

const LimitSchema = z.coerce.number().int().min(1).max(50).default(10);

function limit(req: Request): number {
  const result = LimitSchema.safeParse(req.query['limit']);
  if (!result.success) throw HttpError.badRequest('limit must be 1–50');
  return result.data;
}

export function accountsRoutes(accessTokenSecret: string): Router {
  const router = Router();
  const accounts = new AccountsService();

  router.use(requireAuth(accessTokenSecret));

  router.get('/', async (req, res) => {
    res.json(await accounts.list(userId(req)));
  });

  router.post('/', validateBody(OpenAccountRequestSchema), async (req, res) => {
    res.status(201).json(await accounts.open(userId(req), req.body));
  });

  // Declared before '/:id' so "activity" isn't treated as an account id.
  router.get('/activity', async (req, res) => {
    res.json(await accounts.activity(userId(req), { limit: limit(req) }));
  });

  router.get('/:id', async (req, res) => {
    res.json(await accounts.get(userId(req), param(req, 'id')));
  });

  router.get('/:id/activity', async (req, res) => {
    res.json(
      await accounts.activity(userId(req), {
        accountId: param(req, 'id'),
        limit: limit(req),
      }),
    );
  });

  router.post(
    '/:id/deposit',
    validateBody(MoneyMovementRequestSchema),
    async (req, res) => {
      const key = idempotencyKey(req);
      sendIdempotent(
        res,
        await accounts.deposit(userId(req), param(req, 'id'), req.body, key),
      );
    },
  );

  router.post(
    '/:id/withdraw',
    validateBody(MoneyMovementRequestSchema),
    async (req, res) => {
      const key = idempotencyKey(req);
      sendIdempotent(
        res,
        await accounts.withdraw(userId(req), param(req, 'id'), req.body, key),
      );
    },
  );

  return router;
}
