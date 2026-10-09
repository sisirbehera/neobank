import { Router } from 'express';
import type { HealthResponse } from '@neobank/shared/models';
import { isDbConnected } from '../../config/db';

export function healthRoutes(version: string): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const dbUp = isDbConnected();
    const body: HealthResponse = {
      status: dbUp ? 'ok' : 'degraded',
      db: dbUp ? 'up' : 'down',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version,
    };
    // 503 lets Render's health check restart the service if the DB is unreachable.
    res.status(dbUp ? 200 : 503).json(body);
  });

  return router;
}
