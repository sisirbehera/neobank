import { Router } from 'express';
import { AddBeneficiaryRequestSchema } from '@neobank/shared/models';
import { param, userId } from '../../lib/request';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { BeneficiariesService } from './beneficiaries.service';

export function beneficiariesRoutes(accessTokenSecret: string): Router {
  const router = Router();
  const beneficiaries = new BeneficiariesService();

  router.use(requireAuth(accessTokenSecret));

  router.get('/', async (req, res) => {
    res.json(await beneficiaries.list(userId(req)));
  });

  router.post(
    '/',
    validateBody(AddBeneficiaryRequestSchema),
    async (req, res) => {
      res.status(201).json(await beneficiaries.add(userId(req), req.body));
    },
  );

  router.delete('/:id', async (req, res) => {
    await beneficiaries.remove(userId(req), param(req, 'id'));
    res.status(204).end();
  });

  return router;
}
