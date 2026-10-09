import { z } from 'zod';
import type { AppConfig } from './app-config';

const DEV_ACCESS_SECRET = 'dev-only-access-secret-do-not-use-in-production';
const DEV_MFA_KEY = 'dev-only-mfa-encryption-key-do-not-use-in-production';

/** `KEY=` (empty, e.g. copied from .env.example) means "not set". */
const unset = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().default('localhost'),
    PORT: z.coerce.number().int().positive().default(3333),
    /** Leave empty in development to use an in-memory MongoDB replica set. */
    MONGODB_URI: z.string().optional(),
    /** Folder with the built Angular app. Served by Express when it exists. */
    STATIC_DIR: z.string().default('dist/apps/web/browser'),
    APP_VERSION: z.string().optional(),
    /** Set by Render: the deployed git commit (shown by /api/health). */
    RENDER_GIT_COMMIT: z.string().optional(),
    /** Signs access tokens (JWT, HS256). Long random string in production. */
    JWT_ACCESS_SECRET: z.string().optional(),
    /** Encrypts 2FA secrets stored in MongoDB. Long random string in production. */
    MFA_ENCRYPTION_KEY: z.string().optional(),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    /** Max login/register/refresh requests per IP per 15 minutes. */
    AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
    /** Seed demo users with history. Defaults to on in development only. */
    SEED_DEMO_DATA: unset(z.enum(['true', 'false'])),
    ADMIN_EMAIL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.email().default('admin@neobank.dev'),
    ),
    /** Creates the admin user on startup. Without it (in production) there is no admin. */
    ADMIN_PASSWORD: unset(z.string().min(8)),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !!env.MONGODB_URI, {
    message: 'MONGODB_URI is required in production',
    path: ['MONGODB_URI'],
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      (env.JWT_ACCESS_SECRET?.length ?? 0) >= 32,
    {
      message: 'JWT_ACCESS_SECRET (32+ characters) is required in production',
      path: ['JWT_ACCESS_SECRET'],
    },
  )
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      (env.MFA_ENCRYPTION_KEY?.length ?? 0) >= 32,
    {
      message: 'MFA_ENCRYPTION_KEY (32+ characters) is required in production',
      path: ['MFA_ENCRYPTION_KEY'],
    },
  );

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    console.error(
      'Invalid environment variables:\n' + z.prettifyError(result.error),
    );
    process.exit(1);
  }
  return result.data;
}

export function toAppConfig(env: Env): AppConfig {
  return {
    version: env.APP_VERSION ?? env.RENDER_GIT_COMMIT?.slice(0, 7) ?? '0.0.0',
    staticDir: env.STATIC_DIR,
    auth: {
      accessTokenSecret: env.JWT_ACCESS_SECRET || DEV_ACCESS_SECRET,
      accessTokenTtlMinutes: env.ACCESS_TOKEN_TTL_MINUTES,
      refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      secureCookies: env.NODE_ENV === 'production',
      rateLimit: env.AUTH_RATE_LIMIT,
      mfaEncryptionKey: env.MFA_ENCRYPTION_KEY || DEV_MFA_KEY,
    },
    demoDataEnabled: env.SEED_DEMO_DATA
      ? env.SEED_DEMO_DATA === 'true'
      : env.NODE_ENV === 'development',
  };
}

/** Admin login to create on startup, if any. Development gets a known default. */
export function adminCredentials(
  env: Env,
): { email: string; password: string } | null {
  const password =
    env.ADMIN_PASSWORD ??
    (env.NODE_ENV === 'development' ? 'Admin@1234' : undefined);
  return password ? { email: env.ADMIN_EMAIL, password } : null;
}
