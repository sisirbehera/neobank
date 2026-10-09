import * as z from 'zod/mini';

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['up', 'down']),
  uptimeSeconds: z.number().check(z.nonnegative()),
  timestamp: z.iso.datetime(),
  version: z.string(),
  /** Demo users exist (the login page offers their credentials). */
  demoMode: z.boolean(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** Public demo logins, seeded when demo mode is on. */
export const DEMO_LOGIN = {
  email: 'demo@neobank.dev',
  password: 'Demo@1234',
} as const;
