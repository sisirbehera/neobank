import { Router } from 'express';
import { param, userId } from '../../lib/request';
import { requireAuth } from '../../middleware/auth';
import { NotificationsService } from './notifications';

/** /api/notifications: the signed-in user's in-app notifications. */
export function notificationsRoutes(accessTokenSecret: string): Router {
  const router = Router();
  const notifications = new NotificationsService();

  router.use(requireAuth(accessTokenSecret));

  /** The newest 20, and how many are unread. */
  router.get('/', async (req, res) => {
    res.json(await notifications.list(userId(req)));
  });

  /** Unread count and newest id: what the web app polls. */
  router.get('/summary', async (req, res) => {
    res.json(await notifications.summary(userId(req)));
  });

  router.post('/read-all', async (req, res) => {
    await notifications.markAllRead(userId(req));
    res.status(204).end();
  });

  router.post('/:id/read', async (req, res) => {
    await notifications.markRead(userId(req), param(req, 'id'));
    res.status(204).end();
  });

  return router;
}
