import { Router } from 'express';
import {
  AddBeneficiaryRequestSchema,
  STEP_UP_HEADER,
} from '@neobank/shared/models';
import type { AuthConfig } from '../../config/app-config';
import { MfaService } from '../security/mfa.service';
import { param, userId } from '../../lib/request';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { BeneficiariesService } from './beneficiaries.service';

export function beneficiariesRoutes(config: AuthConfig): Router {
  const router = Router();
  const beneficiaries = new BeneficiariesService(
    new MfaService({
      encryptionKey: config.mfaEncryptionKey,
      tokenSecret: config.accessTokenSecret,
    }),
  );

  router.use(requireAuth(config.accessTokenSecret));

  router.get('/', async (req, res) => {
    res.json(await beneficiaries.list(userId(req)));
  });

  router.post(
    '/',
    validateBody(AddBeneficiaryRequestSchema),
    async (req, res) => {
      res
        .status(201)
        .json(
          await beneficiaries.add(
            userId(req),
            req.body,
            req.get(STEP_UP_HEADER),
          ),
        );
    },
  );

  router.delete('/:id', async (req, res) => {
    await beneficiaries.remove(userId(req), param(req, 'id'));
    res.status(204).end();
  });

  return router;
}
