import { Router } from 'express';
import { HistoryQuerySchema } from '@neobank/shared/models';
import { istDay } from '../../lib/ist';
import { userId } from '../../lib/request';
import { requireAuth } from '../../middleware/auth';
import { parseQuery } from '../../middleware/validate';
import { HistoryService } from './history.service';

export function historyRoutes(accessTokenSecret: string): Router {
  const router = Router();
  const history = new HistoryService();

  router.use(requireAuth(accessTokenSecret));

  /** GET /api/transactions?accountId&type&direction&from&to&q&page&pageSize */
  router.get('/', async (req, res) => {
    res.json(
      await history.list(userId(req), parseQuery(HistoryQuerySchema, req)),
    );
  });

  router.get('/export.csv', async (req, res) => {
    const csv = await history.exportCsv(
      userId(req),
      parseQuery(HistoryQuerySchema, req),
    );
    res
      .type('text/csv; charset=utf-8')
      .attachment(`neobank-statement-${istDay()}.csv`)
      // BOM so Excel opens UTF-8 (names, ₹) correctly.
      .send('﻿' + csv);
  });

  router.get('/summary', async (req, res) => {
    res.json(await history.monthlySummary(userId(req)));
  });

  return router;
}
