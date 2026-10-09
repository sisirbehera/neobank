import { Router } from 'express';
import {
  AdminTransactionsQuerySchema,
  AdminUsersQuerySchema,
  UpdateAccountStatusRequestSchema,
} from '@neobank/shared/models';
import { HttpError } from '../../lib/http-error';
import { param, userId } from '../../lib/request';
import { requireAuth, requireRole } from '../../middleware/auth';
import { parseQuery, validateBody } from '../../middleware/validate';
import { seedDemoData } from '../../seed/demo-data';
import { AdminService } from './admin.service';

export interface AdminRoutesOptions {
  accessTokenSecret: string;
  /** Allow POST /api/admin/demo/reset (only when demo data is enabled). */
  demoDataEnabled: boolean;
}

export function adminRoutes({
  accessTokenSecret,
  demoDataEnabled,
}: AdminRoutesOptions): Router {
  const router = Router();
  const admin = new AdminService();

  // Every route below: signed in AND role "admin".
  router.use(requireAuth(accessTokenSecret), requireRole('admin'));

  router.get('/stats', async (_req, res) => {
    res.json(await admin.stats());
  });

  router.get('/users', async (req, res) => {
    res.json(await admin.users(parseQuery(AdminUsersQuerySchema, req)));
  });

  router.get('/users/:id', async (req, res) => {
    res.json(await admin.user(param(req, 'id')));
  });

  router.patch(
    '/accounts/:id/status',
    validateBody(UpdateAccountStatusRequestSchema),
    async (req, res) => {
      res.json(
        await admin.setAccountStatus(userId(req), param(req, 'id'), req.body),
      );
    },
  );

  router.get('/transactions', async (req, res) => {
    res.json(
      await admin.transactions(parseQuery(AdminTransactionsQuerySchema, req)),
    );
  });

  router.get('/audit', async (_req, res) => {
    res.json(await admin.audit());
  });

  router.post('/demo/reset', async (req, res) => {
    if (!demoDataEnabled) {
      throw HttpError.notFound('Demo data is not enabled on this server');
    }
    await seedDemoData({ reset: true });
    await admin.record(userId(req), 'DEMO_RESET', 'Demo users and their data');
    res.status(204).end();
  });

  return router;
}
