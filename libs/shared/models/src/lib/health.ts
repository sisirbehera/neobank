import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['up', 'down']),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
  version: z.string(),
  /** Demo users exist (the login page offers their credentials). */
  demoMode: z.boolean(),
});

/** Public demo logins, seeded when demo mode is on. */
export const DEMO_LOGIN = {
  email: 'demo@neobank.dev',
  password: 'Demo@1234',
} as const;

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
