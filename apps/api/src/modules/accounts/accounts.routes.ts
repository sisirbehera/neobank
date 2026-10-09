import { type Request, Router } from 'express';
import { z } from 'zod';
import {
  MoneyMovementRequestSchema,
  OpenAccountRequestSchema,
} from '@neobank/shared/models';
import { HttpError } from '../../lib/http-error';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { AccountsService } from './accounts.service';

const LimitSchema = z.coerce.number().int().min(1).max(50).default(10);

/** The signed-in user's id (requireAuth guarantees it is set). */
function userId(req: Request): string {
  if (!req.auth) throw HttpError.unauthorized();
  return req.auth.userId;
}

/** The :id route parameter (Express types it loosely once middleware is added). */
function accountId(req: Request): string {
  return String(req.params['id']);
}

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
    res.json(await accounts.get(userId(req), accountId(req)));
  });

  router.get('/:id/activity', async (req, res) => {
    res.json(
      await accounts.activity(userId(req), {
        accountId: accountId(req),
        limit: limit(req),
      }),
    );
  });

  router.post(
    '/:id/deposit',
    validateBody(MoneyMovementRequestSchema),
    async (req, res) => {
      res.json(await accounts.deposit(userId(req), accountId(req), req.body));
    },
  );

  router.post(
    '/:id/withdraw',
    validateBody(MoneyMovementRequestSchema),
    async (req, res) => {
      res.json(await accounts.withdraw(userId(req), accountId(req), req.body));
    },
  );

  return router;
}
