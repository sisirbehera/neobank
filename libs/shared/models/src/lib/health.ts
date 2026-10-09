import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['up', 'down']),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
